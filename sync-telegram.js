// 从Telegram同步所有图片到数据库的API端点
const https = require('https');
const { addImage, getImageByFileId } = require('./kv-database');
const { verifyAdminToken } = require('./auth-middleware');

// 从环境变量获取配置
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// 验证环境变量
if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'your_bot_token_here') {
    console.error('错误: TELEGRAM_BOT_TOKEN 环境变量未设置或使用了占位符值');
}

if (!TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID === 'your_chat_id_here') {
    console.error('错误: TELEGRAM_CHAT_ID 环境变量未设置或使用了占位符值');
}

module.exports = async (req, res) => {
    // 设置CORS头
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    
    // 处理预检请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // 只接受GET和POST请求
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    // 验证管理员权限
    const authResult = verifyAdminToken(req);
    if (!authResult.valid) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // 验证环境变量
    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'your_bot_token_here') {
        return res.status(500).json({ 
            error: 'Configuration error', 
            message: 'TELEGRAM_BOT_TOKEN 环境变量未设置或使用了占位符值。请在部署环境中设置正确的Bot Token。' 
        });
    }
    
    if (!TELEGRAM_CHAT_ID || TELEGRAM_CHAT_ID === 'your_chat_id_here') {
        return res.status(500).json({ 
            error: 'Configuration error', 
            message: 'TELEGRAM_CHAT_ID 环境变量未设置或使用了占位符值。请在部署环境中设置正确的Chat ID。' 
        });
    }
    
    try {
        console.log('开始从Telegram同步图片...');
        
        // 检查是否是频道（频道ID通常是负数）
        const isChannel = TELEGRAM_CHAT_ID.startsWith('-');
        
        let profilePhotos = [];
        let chatPhotos = [];
        
        if (isChannel) {
            console.log('检测到频道ID，跳过获取个人资料照片');
        } else {
            // 获取用户个人资料照片
            console.log('正在获取用户个人资料照片...');
            profilePhotos = await getUserProfilePhotos();
            console.log(`找到 ${profilePhotos.length} 张个人资料照片`);
        }
        
        // 获取聊天消息中的图片
        console.log('正在获取聊天消息中的图片...');
        chatPhotos = await getChatPhotos();
        console.log(`找到 ${chatPhotos.length} 张聊天消息中的图片`);
        
        // 合并所有图片
        const allPhotos = [...profilePhotos, ...chatPhotos];
        console.log(`总共找到 ${allPhotos.length} 张图片`);
        
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
            totalPhotos: allPhotos.length,
            profilePhotosCount: profilePhotos.length,
            chatPhotosCount: chatPhotos.length
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
            // 检查是否是频道（频道ID通常是负数）
            const isChannel = TELEGRAM_CHAT_ID.startsWith('-');
            
            if (isChannel) {
                console.log('频道不支持获取个人资料照片，返回空数组');
                return resolve([]);
            }
            
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
            const photos = [];
            const isChannel = TELEGRAM_CHAT_ID.startsWith('-');
            
            if (isChannel) {
                console.log('检测到频道，尝试获取频道历史消息...');
                
                // 对于频道，我们需要使用不同的方法获取历史消息
                // 首先尝试获取频道信息
                const chatOptions = {
                    hostname: 'api.telegram.org',
                    port: 443,
                    path: `/bot${TELEGRAM_BOT_TOKEN}/getChat?chat_id=${TELEGRAM_CHAT_ID}`,
                    method: 'GET',
                    timeout: 10000 // 10秒超时
                };
                
                const chatReq = https.request(chatOptions, (chatRes) => {
                    let chatData = '';
                    chatRes.on('data', (chunk) => {
                        chatData += chunk;
                    });
                    chatRes.on('end', async () => {
                        try {
                            const chatResponse = JSON.parse(chatData);
                            if (chatRes.statusCode >= 200 && chatRes.statusCode < 300) {
                                if (chatResponse.ok) {
                                    console.log('成功获取频道信息:', chatResponse.result.title);
                                    
                                    // 尝试使用searchChatHistory方法获取历史消息
                                    // 注意：这个方法可能需要bot是频道的管理员
                                    await getChannelHistoryMessages(photos, resolve, reject);
                                } else {
                                    console.error('获取频道信息失败:', chatResponse.description);
                                    // 如果获取频道信息失败，尝试使用getUpdates作为后备方案
                                    await getUpdatesFallback(photos, resolve, reject);
                                }
                            } else {
                                console.error(`获取频道信息HTTP错误: ${chatRes.statusCode}`);
                                // 如果获取频道信息失败，尝试使用getUpdates作为后备方案
                                await getUpdatesFallback(photos, resolve, reject);
                            }
                        } catch (error) {
                            console.error('解析频道信息响应失败:', error.message);
                            // 如果解析失败，尝试使用getUpdates作为后备方案
                            await getUpdatesFallback(photos, resolve, reject);
                        }
                    });
                });
                
                chatReq.on('error', (error) => {
                    console.error('获取频道信息请求失败:', error);
                    // 如果请求失败，尝试使用getUpdates作为后备方案
                    getUpdatesFallback(photos, resolve, reject);
                });
                
                chatReq.on('timeout', () => {
                    chatReq.destroy();
                    console.error('获取频道信息请求超时');
                    // 如果请求超时，尝试使用getUpdates作为后备方案
                    getUpdatesFallback(photos, resolve, reject);
                });
                
                chatReq.end();
            } else {
                // 对于普通聊天，使用getUpdates方法
                getUpdatesFallback(photos, resolve, reject);
            }
        } catch (error) {
            reject(error);
        }
    });
}

// 获取频道历史消息的辅助函数
async function getChannelHistoryMessages(photos, resolve, reject) {
    try {
        // 首先尝试使用searchChatHistory方法（需要bot是频道管理员）
        await trySearchChatHistory(photos, resolve, reject);
    } catch (error) {
        console.error('searchChatHistory方法失败，尝试getChatHistory方法:', error.message);
        // 如果searchChatHistory失败，尝试getChatHistory方法
        await tryGetChatHistory(photos, resolve, reject);
    }
}

// 尝试使用searchChatHistory方法
async function trySearchChatHistory(photos, resolve, reject) {
    return new Promise((res, rej) => {
        const searchOptions = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${TELEGRAM_BOT_TOKEN}/searchChatHistory?chat_id=${TELEGRAM_CHAT_ID}&query=""&limit=100`,
            method: 'GET',
            timeout: 15000 // 15秒超时
        };
        
        const searchReq = https.request(searchOptions, (searchRes) => {
            let searchData = '';
            searchRes.on('data', (chunk) => {
                searchData += chunk;
            });
            searchRes.on('end', async () => {
                try {
                    const searchResponse = JSON.parse(searchData);
                    if (searchRes.statusCode >= 200 && searchRes.statusCode < 300) {
                        if (searchResponse.ok && searchResponse.result && searchResponse.result.messages) {
                            console.log(`成功通过searchChatHistory获取到 ${searchResponse.result.messages.length} 条历史消息`);
                            
                            // 处理历史消息
                            await processMessages(searchResponse.result.messages, photos);
                            
                            // 如果还有更多消息，尝试获取更多
                            if (searchResponse.result.total_count > searchResponse.result.messages.length) {
                                console.log(`还有更多消息，总数: ${searchResponse.result.total_count}`);
                                // 这里可以实现分页获取更多消息的逻辑
                            }
                            
                            console.log(`从历史消息中获取到 ${photos.length} 张图片`);
                            resolve(photos);
                            res();
                        } else {
                            console.log('searchChatHistory方法返回空结果');
                            rej(new Error('searchChatHistory返回空结果'));
                        }
                    } else {
                        console.error(`searchChatHistory HTTP错误: ${searchRes.statusCode}`);
                        rej(new Error(`searchChatHistory HTTP错误: ${searchRes.statusCode}`));
                    }
                } catch (error) {
                    console.error('解析searchChatHistory响应失败:', error.message);
                    rej(error);
                }
            });
        });
        
        searchReq.on('error', (error) => {
            console.error('searchChatHistory请求失败:', error);
            rej(error);
        });
        
        searchReq.on('timeout', () => {
            searchReq.destroy();
            console.error('searchChatHistory请求超时');
            rej(new Error('searchChatHistory请求超时'));
        });
        
        searchReq.end();
    });
}

// 尝试使用getChatHistory方法
async function tryGetChatHistory(photos, resolve, reject) {
    return new Promise((res, rej) => {
        // 使用getChatHistory方法获取历史消息
        const historyOptions = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${TELEGRAM_BOT_TOKEN}/getChatHistory?chat_id=${TELEGRAM_CHAT_ID}&limit=100`,
            method: 'GET',
            timeout: 15000 // 15秒超时
        };
        
        const historyReq = https.request(historyOptions, (historyRes) => {
            let historyData = '';
            historyRes.on('data', (chunk) => {
                historyData += chunk;
            });
            historyRes.on('end', async () => {
                try {
                    const historyResponse = JSON.parse(historyData);
                    if (historyRes.statusCode >= 200 && historyRes.statusCode < 300) {
                        if (historyResponse.ok && historyResponse.result && historyResponse.result.messages) {
                            console.log(`成功通过getChatHistory获取到 ${historyResponse.result.messages.length} 条历史消息`);
                            
                            // 处理历史消息
                            await processMessages(historyResponse.result.messages, photos);
                            
                            // 如果还有更多消息，尝试获取更多
                            if (historyResponse.result.total_count > historyResponse.result.messages.length) {
                                console.log(`还有更多消息，总数: ${historyResponse.result.total_count}`);
                                // 这里可以实现分页获取更多消息的逻辑
                            }
                            
                            console.log(`从历史消息中获取到 ${photos.length} 张图片`);
                            resolve(photos);
                            res();
                        } else {
                            console.log('getChatHistory方法返回空结果，尝试使用getUpdates作为后备方案');
                            await getUpdatesFallback(photos, resolve, reject);
                            res();
                        }
                    } else {
                        console.error(`getChatHistory HTTP错误: ${historyRes.statusCode}`);
                        await getUpdatesFallback(photos, resolve, reject);
                        res();
                    }
                } catch (error) {
                    console.error('解析getChatHistory响应失败:', error.message);
                    await getUpdatesFallback(photos, resolve, reject);
                    res();
                }
            });
        });
        
        historyReq.on('error', (error) => {
            console.error('getChatHistory请求失败:', error);
            getUpdatesFallback(photos, resolve, reject);
            res();
        });
        
        historyReq.on('timeout', () => {
            historyReq.destroy();
            console.error('getChatHistory请求超时');
            getUpdatesFallback(photos, resolve, reject);
            res();
        });
        
        historyReq.end();
    });
}

// 处理消息的辅助函数
async function processMessages(messages, photos) {
    for (const message of messages) {
        // 处理照片消息
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
                            file_id: fileId,
                            ...photo,
                            url: imageUrl,
                            type: 'message_photo',
                            messageId: message.message_id,
                            from: message.from?.id || 'channel',
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
                            file_id: fileId,
                            url: imageUrl,
                            type: 'document_image',
                            messageId: message.message_id,
                            from: message.from?.id || 'channel',
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

// getUpdates的后备方案
async function getUpdatesFallback(photos, resolve, reject) {
    try {
        console.log('使用getUpdates方法获取消息更新...');
        
        const options = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=100&allowed_updates=["message","channel_post"]`,
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
                        if (response.ok && response.result && Array.isArray(response.result)) {
                            // 处理消息更新
                            await processMessages(response.result.map(update => update.message || update.channel_post).filter(Boolean), photos);
                            
                            console.log(`从getUpdates获取到 ${photos.length} 张图片`);
                            resolve(photos);
                        } else {
                            console.log('没有获取到消息更新');
                            resolve(photos);
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${response.description || 'Unknown error'}`));
                    }
                } catch (error) {
                    reject(new Error(`Failed to parse getUpdates response: ${error.message}`));
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

