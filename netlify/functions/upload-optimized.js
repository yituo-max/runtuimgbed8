const https = require('https');
const querystring = require('querystring');
const { verifyAdminToken } = require('./auth-middleware');

// 从环境变量获取配置
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const NETLIFY_SITE_URL = process.env.NETLIFY_SITE_URL || 'https://your-site.netlify.app';

// 简单的请求频率限制
const requestCounts = {};
const RATE_LIMIT_WINDOW = 60000; // 1分钟
const RATE_LIMIT_MAX_REQUESTS = 10; // 每分钟最多10次请求

// 检查请求频率限制
function checkRateLimit(clientId) {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;
    
    // 初始化客户端计数器
    if (!requestCounts[clientId]) {
        requestCounts[clientId] = [];
    }
    
    // 清理过期的请求记录
    requestCounts[clientId] = requestCounts[clientId].filter(timestamp => timestamp > windowStart);
    
    // 检查是否超过限制
    if (requestCounts[clientId].length >= RATE_LIMIT_MAX_REQUESTS) {
        return false;
    }
    
    // 记录当前请求
    requestCounts[clientId].push(now);
    return true;
}

exports.handler = async function(event, context) {
    // 只在开发环境记录详细日志
    const isDev = process.env.NODE_ENV === 'development';
    
    // 设置CORS头
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    
    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers
        };
    }
    
    // 只接受POST请求
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }
    
    // 验证管理员权限
    const authResult = verifyAdminToken(event);
    if (!authResult.valid) {
        return {
            statusCode: authResult.statusCode,
            headers,
            body: JSON.stringify({ error: authResult.error })
        };
    }

    // 获取客户端ID进行频率限制
    const clientId = event.headers['x-forwarded-for'] || 
                     event.headers['client-ip'] || 
                     'unknown';
    
    // 检查请求频率限制
    if (!checkRateLimit(clientId)) {
        return {
            statusCode: 429,
            headers,
            body: JSON.stringify({ 
                error: 'Too many requests. Please try again later.',
                retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
            })
        };
    }

    try {
        // 解析multipart/form-data
        const formData = await parseMultipartData(event);
        
        if (!formData || !formData.image) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No image provided' })
            };
        }

        // 检查文件大小（限制为5MB）
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (formData.image.data.length > maxSize) {
            return {
                statusCode: 413,
                headers,
                body: JSON.stringify({ 
                    error: 'File too large. Maximum size is 5MB.' 
                })
            };
        }

        // 上传图片到Telegram
        const telegramResponse = await uploadToTelegram(formData.image);
        
        if (!telegramResponse.ok) {
            return {
                statusCode: 500,
                body: JSON.stringify({ 
                    error: 'Failed to upload to Telegram',
                    details: telegramResponse.description || 'Unknown error'
                })
            };
        }

        // 获取图片信息
        const file = telegramResponse.result.photo[telegramResponse.result.photo.length - 1];
        const fileId = file.file_id;
        
        // 获取文件路径
        const fileResponse = await getTelegramFilePath(fileId);
        
        if (!fileResponse.ok) {
            return {
                statusCode: 500,
                body: JSON.stringify({ 
                    error: 'Failed to get file path',
                    details: fileResponse.description || 'Unknown error'
                })
            };
        }

        // 构建图片URL
        const imageUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileResponse.result.file_path}`;
        
        // 返回结果
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                imageUrl: imageUrl,
                fileId: fileId,
                fileSize: file.file_size
            })
        };
    } catch (error) {
        if (isDev) {
            console.error('Error details:', error);
        }
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error'
            })
        };
    }
};

// 解析multipart/form-data
async function parseMultipartData(event) {
    return new Promise((resolve, reject) => {
        try {
            const contentType = event.headers['content-type'] || event.headers['Content-Type'];
            
            if (!contentType || !contentType.includes('multipart/form-data')) {
                return reject(new Error(`Invalid content type: ${contentType}`));
            }

            const boundaryMatch = contentType.match(/boundary=([^;]+)/);
            const boundary = boundaryMatch ? boundaryMatch[1] : null;
            
            if (!boundary) {
                return reject(new Error('No boundary found in content-type'));
            }
            
            let body;
            try {
                body = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
            } catch (error) {
                return reject(new Error(`Failed to decode body: ${error.message}`));
            }
            
            // 查找所有边界分隔符
            const boundaryPattern = new RegExp(`--${boundary}`, 'g');
            const parts = body.toString('binary').split(boundaryPattern);
            
            const formData = {};
            
            for (let i = 1; i < parts.length - 1; i++) {
                const part = parts[i];
                if (!part.trim()) continue;
                
                const headersEnd = part.indexOf('\r\n\r\n');
                if (headersEnd === -1) continue;
                
                const headers = part.substring(0, headersEnd);
                const content = part.substring(headersEnd + 4);
                
                const nameMatch = headers.match(/name="([^"]+)"/);
                if (!nameMatch) continue;
                
                const name = nameMatch[1];
                
                // 如果是文件，提取文件信息
                const filenameMatch = headers.match(/filename="([^"]+)"/);
                if (filenameMatch) {
                    const filename = filenameMatch[1];
                    const contentTypeMatch = headers.match(/Content-Type:\s*(.+)/);
                    const mimeType = contentTypeMatch ? contentTypeMatch[1].trim() : '';
                    
                    // 将二进制内容转换回Buffer
                    const binaryContent = Buffer.from(content, 'binary');
                    
                    formData[name] = {
                        filename,
                        mimeType,
                        data: binaryContent
                    };
                } else {
                    formData[name] = content.toString();
                }
            }
            
            resolve(formData);
        } catch (error) {
            reject(error);
        }
    });
}

// 上传图片到Telegram
async function uploadToTelegram(imageData) {
    return new Promise((resolve, reject) => {
        try {
            // 创建multipart/form-data格式的数据
            const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substr(2, 16);
            
            let formData = '';
            
            // 添加chat_id字段
            formData += `--${boundary}\r\n`;
            formData += `Content-Disposition: form-data; name="chat_id"\r\n\r\n`;
            formData += `${TELEGRAM_CHAT_ID}\r\n`;
            
            // 添加photo字段
            formData += `--${boundary}\r\n`;
            formData += `Content-Disposition: form-data; name="photo"; filename="${imageData.filename}"\r\n`;
            formData += `Content-Type: ${imageData.mimeType}\r\n\r\n`;
            
            const formDataHeader = Buffer.from(formData, 'utf8');
            const formDataFooter = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
            
            const options = {
                hostname: 'api.telegram.org',
                port: 443,
                path: `/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': formDataHeader.length + imageData.data.length + formDataFooter.length
                },
                timeout: 15000 // 15秒超时
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
                        reject(new Error(`Failed to parse response: ${error.message}`));
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
            
            // 发送数据
            req.write(formDataHeader);
            req.write(imageData.data);
            req.write(formDataFooter);
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