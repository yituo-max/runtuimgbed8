const { verifyAdminToken } = require('./auth-middleware');
const { getImage, deleteImage } = require('./kv-database');

exports.handler = async function(event, context) {
    // 设置CORS头
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS'
    };
    
    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers
        };
    }
    
    // 只接受GET和DELETE请求
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'DELETE') {
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
        // 从查询参数获取图片ID
        const queryStringParameters = event.queryStringParameters || {};
        const imageId = queryStringParameters.id;
        
        if (!imageId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Image ID is required' })
            };
        }
        
        // 获取图片信息
        const image = getImage(imageId);
        
        if (!image) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Image not found' })
            };
        }
        
        // 处理GET请求 - 获取图片信息
        if (event.httpMethod === 'GET') {
            // 检查是否有serve参数，如果有则重定向到图片URL
            if (queryStringParameters.serve === 'true') {
                return {
                    statusCode: 302,
                    headers: {
                        ...headers,
                        'Location': image.url
                    }
                };
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    image
                })
            };
        }
        
        // 处理DELETE请求 - 删除图片
        if (event.httpMethod === 'DELETE') {
            const deletedImage = deleteImage(imageId);
            
            if (!deletedImage) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'Image not found' })
                };
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Image deleted successfully',
                    deletedImage
                })
            };
        }
    } catch (error) {
        console.error('Error handling image request:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
};