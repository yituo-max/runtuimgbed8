// 从Telegram同步所有图片到数据库的API端点
const https = require('https');
const { addImage, getImageByFileId } = require('./kv-database');
const { verifyAdminToken } = require('./auth-middleware');

// 从环境变量获取配置
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

module.exports = async (req, res) => {
    // 设置CORS头
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    // 处理预检请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // 只接受GET请求
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    // 验证管理员权限
    const authResult = verifyAdminToken(req);
    if (!authResult.valid) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        console.log('开始从Telegram同步图片...');
        
        // 获取用户个人资料照片
        const profilePhotos = await getUserProfilePhotos();
        
        // 获取聊天消息中的图片
        const chatPhotos = await getChatPhotos();
        
        // 合并所有图片
        const allPhotos = [...profilePhotos, ...chatPhotos];
        
        // 同步到数据库
        let syncedCount = 0;
        let skippedCount = 0;
        
        for (const photo of allPhotos) {
            try {
                // 检查图片是否已经存在于数据库中
                const existingImage = await getImageByFileId(photo.file_id);
                
                if (!existingImage) {
                    // 根据图片类型确定分类
                    let category = 'general';
                    if (photo.type === 'user_profile') {
                        category = 'avatar';
                    } else if (photo.type === 'message_photo' || photo.type === 'document_image') {
                        category = 'chat';
                    }
                    
                    // 构建图片信息（photo对象已经包含url）
                    const imageInfo = {
                        filename: `telegram_${photo.file_id}`,
                        url: photo.url,
                        size: photo.file_size || photo.fileSize || 0,
                        fileId: photo.file_id,
                        category: category,
                        type: photo.type,
                        metadata: {
                            messageId: photo.messageId,
                            from: photo.from,
                            date: photo.date,
                            caption: photo.caption,
                            fileName: photo.fileName
                        }
                    };
                    
                    await addImage(imageInfo);
                    syncedCount++;
                    console.log(`已同步图片: ${photo.file_id} (${photo.type})`);
                } else {
                    skippedCount++;
                    console.log(`跳过已存在的图片: ${photo.file_id}`);
                }
            } catch (error) {
                console.error(`同步图片 ${photo.file_id} 时出错:`, error);
            }
        }
        
        return res.status(200).json({
            success: true,
            message: `同步完成，新增 ${syncedCount} 张图片，跳过 ${skippedCount} 张已存在的图片`,
            syncedCount,
            skippedCount,
            totalPhotos: allPhotos.length
        });
    } catch (error) {
        console.error('同步Telegram图片时出错:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
};

// 获取用户个人资料照片
async function getUserProfilePhotos() {
    return new Promise((resolve, reject) => {
        try {
            const options = {
                hostname: 'api.telegram.org',
                port: 443,
                path: `/bot${TELEGRAM_BOT_TOKEN}/getUserProfilePhotos?user_id=${TELEGRAM_CHAT_ID}&limit=100`,
                method: 'GET',
                timeout: 10000 // 10秒超时
            };
            
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', async () => {
                    try {
                        const response = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            // 提取所有照片信息
                            const photos = [];
                            if (response.ok && response.result && response.result.photos) {
                                for (const photoGroup of response.result.photos) {
                                    // 每组照片中，最后一张是最大分辨率的
                                    const largestPhoto = photoGroup[photoGroup.length - 1];
                                    if (largestPhoto && largestPhoto.file_id) {
                                        const fileId = largestPhoto.file_id;
                                        
                                        // 检查图片是否已存在于数据库中
                                        const existingImage = await getImageByFileId(fileId);
                                        if (!existingImage) {
                                            // 获取文件路径
                                            const fileResponse = await getTelegramFilePath(fileId);
                                            if (fileResponse.ok && fileResponse.result.file_path) {
                                                // 构建图片URL
                                                const imageUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileResponse.result.file_path}`;
                                                
                                                // 添加到图片数组
                                                photos.push({
                                                    ...largestPhoto,
                                                    url: imageUrl,
                                                    type: 'user_profile'
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                            resolve(photos);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${response.description || 'Unknown error'}`));
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse getUserProfilePhotos response: ${error.message}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.end();
        } catch (error) {
            reject(error);
        }
    });
}

// 获取聊天消息中的图片
async function getChatPhotos() {
    return new Promise((resolve, reject) => {
        try {
            // 注意：这个方法需要更复杂的实现，因为需要遍历聊天历史
            // 这里提供一个简化版本，只获取最近的消息
            const options = {
                hostname: 'api.telegram.org',
                port: 443,
                path: `/bot${TELEGRAM_BOT_TOKEN}/getChatHistory?chat_id=${TELEGRAM_CHAT_ID}&limit=100`,
                method: 'GET',
                timeout: 15000 // 15秒超时
            };
            
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', async () => {
                    try {
                        const response = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            // 提取所有照片信息
                            const photos = [];
                            if (response.ok && response.result && response.result.messages) {
                                for (const message of response.result.messages) {
                                    if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
                                        // 获取最高分辨率的照片（数组中的最后一个）
                                        const photo = message.photo[message.photo.length - 1];
                                        if (photo && photo.file_id) {
                                            const fileId = photo.file_id;
                                            
                                            // 检查图片是否已存在于数据库中
                                            const existingImage = await getImageByFileId(fileId);
                                            if (!existingImage) {
                                                // 获取文件路径
                                                const fileResponse = await getTelegramFilePath(fileId);
                                                if (fileResponse.ok && fileResponse.result.file_path) {
                                                    // 构建图片URL
                                                    const imageUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileResponse.result.file_path}`;
                                                    
                                                    // 添加到图片数组
                                                    photos.push({
                                                        ...photo,
                                                        url: imageUrl,
                                                        type: 'message_photo',
                                                        messageId: message.message_id,
                                                        from: message.from?.id || 'unknown',
                                                        date: message.date,
                                                        caption: message.caption || ''
                                                    });
                                                }
                                            }
                                        }
                                    }
                                    
                                    // 处理消息中的文档（可能是图片）
                                    if (message.document && message.document.file_id && message.document.mime_type) {
                                        // 检查是否是图片类型
                                        if (message.document.mime_type.startsWith('image/')) {
                                            const fileId = message.document.file_id;
                                            
                                            // 检查图片是否已存在于数据库中
                                            const existingImage = await getImageByFileId(fileId);
                                            if (!existingImage) {
                                                // 获取文件路径
                                                const fileResponse = await getTelegramFilePath(fileId);
                                                if (fileResponse.ok && fileResponse.result.file_path) {
                                                    // 构建图片URL
                                                    const imageUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileResponse.result.file_path}`;
                                                    
                                                    // 添加到图片数组
                                                    photos.push({
                                                        fileId: fileId,
                                                        url: imageUrl,
                                                        type: 'document_image',
                                                        messageId: message.message_id,
                                                        from: message.from?.id || 'unknown',
                                                        date: message.date,
                                                        caption: message.caption || '',
                                                        fileName: message.document.file_name || '',
                                                        mimeType: message.document.mime_type,
                                                        fileSize: message.document.file_size || 0
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            resolve(photos);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${response.description || 'Unknown error'}`));
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse getChatHistory response: ${error.message}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.end();
        } catch (error) {
            reject(error);
        }
    });
}

// 获取Telegram文件路径
async function getTelegramFilePath(fileId) {
    return new Promise((resolve, reject) => {
        try {
            const options = {
                hostname: 'api.telegram.org',
                port: 443,
                path: `/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`,
                method: 'GET',
                timeout: 10000 // 10秒超时
            };
            
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(response);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${response.description || 'Unknown error'}`));
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse getFile response: ${error.message}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.end();
        } catch (error) {
            reject(error);
        }
    });
}

