const https = require('https');
const querystring = require('querystring');
const { verifyAdminToken } = require('./auth-middleware');

// 从环境变量获取配置
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const NETLIFY_SITE_URL = process.env.NETLIFY_SITE_URL || 'https://your-site.netlify.app';

exports.handler = async function(event, context) {
    // 添加调试日志
    console.log('Function invoked with HTTP method:', event.httpMethod);
    console.log('Environment variables check:');
    console.log('TELEGRAM_BOT_TOKEN exists:', !!process.env.TELEGRAM_BOT_TOKEN);
    console.log('TELEGRAM_CHAT_ID:', process.env.TELEGRAM_CHAT_ID);
    
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

    try {
        // 解析multipart/form-data
        const formData = await parseMultipartData(event);
        
        if (!formData || !formData.image) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No image provided' })
            };
        }

        console.log('Image data received:', {
            filename: formData.image.filename,
            mimeType: formData.image.mimeType,
            size: formData.image.data.length
        });

        // 上传图片到Telegram
        const telegramResponse = await uploadToTelegram(formData.image);
        console.log('Telegram response:', telegramResponse);
        
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
        console.log('File path response:', fileResponse);
        
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
        console.error('Error details:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                stack: error.stack
            })
        };
    }
};

// 解析multipart/form-data
async function parseMultipartData(event) {
    return new Promise((resolve, reject) => {
        try {
            console.log('Parsing multipart data...');
            console.log('Headers:', JSON.stringify(event.headers, null, 2));
            console.log('Is base64 encoded:', event.isBase64Encoded);
            console.log('Body length:', event.body ? event.body.length : 0);
            
            const contentType = event.headers['content-type'] || event.headers['Content-Type'];
            console.log('Content-Type:', contentType);
            
            if (!contentType || !contentType.includes('multipart/form-data')) {
                return reject(new Error(`Invalid content type: ${contentType}`));
            }

            const boundaryMatch = contentType.match(/boundary=([^;]+)/);
            const boundary = boundaryMatch ? boundaryMatch[1] : null;
            
            if (!boundary) {
                return reject(new Error('No boundary found in content-type'));
            }
            
            console.log('Boundary:', boundary);

            let body;
            try {
                body = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
                console.log('Body buffer created successfully, length:', body.length);
            } catch (error) {
                console.error('Error creating body buffer:', error);
                return reject(new Error(`Failed to decode body: ${error.message}`));
            }
            
            // 查找所有边界分隔符
            const boundaryPattern = new RegExp(`--${boundary}`, 'g');
            const parts = body.toString('binary').split(boundaryPattern);
            console.log('Number of parts found:', parts.length);
            
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
                console.log(`Processing field: ${name}`);
                
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
                    
                    console.log(`File field processed: ${filename}, size: ${binaryContent.length}, type: ${mimeType}`);
                } else {
                    formData[name] = content.toString();
                    console.log(`Text field processed: ${name}`);
                }
            }
            
            console.log('Form data parsed successfully:', Object.keys(formData));
            resolve(formData);
        } catch (error) {
            console.error('Error in parseMultipartData:', error);
            reject(error);
        }
    });
}

// 上传图片到Telegram
async function uploadToTelegram(imageData) {
    return new Promise((resolve, reject) => {
        try {
            console.log('Uploading image to Telegram...');
            console.log('Image info:', {
                filename: imageData.filename,
                mimeType: imageData.mimeType,
                size: imageData.data.length
            });
            
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
            
            console.log('Form data prepared, sending request...');
            
            const options = {
                hostname: 'api.telegram.org',
                port: 443,
                path: `/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': formDataHeader.length + imageData.data.length + formDataFooter.length
                }
            };
            
            console.log('Request options:', {
                hostname: options.hostname,
                path: options.path,
                method: options.method,
                headers: {
                    'Content-Type': options.headers['Content-Type'],
                    'Content-Length': options.headers['Content-Length']
                }
            });
            
            const req = https.request(options, (res) => {
                console.log('Response status:', res.statusCode);
                console.log('Response headers:', res.headers);
                
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    console.log('Response body:', data);
                    try {
                        const response = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(response);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${response.description || 'Unknown error'}`));
                        }
                    } catch (error) {
                        console.error('Error parsing response:', error);
                        reject(new Error(`Failed to parse response: ${error.message}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                console.error('Request error:', error);
                reject(error);
            });
            
            // 发送数据
            req.write(formDataHeader);
            req.write(imageData.data);
            req.write(formDataFooter);
            req.end();
        } catch (error) {
            console.error('Error in uploadToTelegram:', error);
            reject(error);
        }
    });
}

// 获取Telegram文件路径
async function getTelegramFilePath(fileId) {
    return new Promise((resolve, reject) => {
        try {
            console.log('Getting file path for fileId:', fileId);
            
            const options = {
                hostname: 'api.telegram.org',
                port: 443,
                path: `/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`,
                method: 'GET'
            };
            
            console.log('Request options for getFile:', {
                hostname: options.hostname,
                path: options.path,
                method: options.method
            });
            
            const req = https.request(options, (res) => {
                console.log('GetFile response status:', res.statusCode);
                console.log('GetFile response headers:', res.headers);
                
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    console.log('GetFile response body:', data);
                    try {
                        const response = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(response);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${response.description || 'Unknown error'}`));
                        }
                    } catch (error) {
                        console.error('Error parsing getFile response:', error);
                        reject(new Error(`Failed to parse getFile response: ${error.message}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                console.error('GetFile request error:', error);
                reject(error);
            });
            
            req.end();
        } catch (error) {
            console.error('Error in getTelegramFilePath:', error);
            reject(error);
        }
    });
}