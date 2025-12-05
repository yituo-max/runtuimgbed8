const { verifyAdminToken } = require('./auth-middleware');
const { 
    getImages, 
    getImage, 
    addImage, 
    updateImage, 
    deleteImage, 
    getCategories, 
    getStats 
} = require('./kv-database');

exports.handler = async function(event, context) {
    // 设置CORS头
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    };
    
    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers
        };
    }
    
    // 验证管理员权限（除了GET请求）
    if (event.httpMethod !== 'GET') {
        const authResult = verifyAdminToken(event);
        if (!authResult.valid) {
            return {
                statusCode: authResult.statusCode,
                headers,
                body: JSON.stringify({ error: authResult.error })
            };
        }
    }
    
    try {
        // 获取查询参数
        const queryParams = event.queryStringParameters || {};
        
        // 处理GET请求 - 获取图片列表或单个图片
        if (event.httpMethod === 'GET') {
            // 检查是否有id参数，如果有则返回单个图片
            if (queryParams.id) {
                const image = getImage(queryParams.id);
                if (!image) {
                    return {
                        statusCode: 404,
                        headers,
                        body: JSON.stringify({ error: 'Image not found' })
                    };
                }
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, image })
                };
            }
            
            // 否则返回图片列表
            const page = parseInt(queryParams.page) || 1;
            const limit = parseInt(queryParams.limit) || 20;
            const category = queryParams.category || '';
            
            // 验证参数
            if (isNaN(page) || page < 1) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid page parameter' })
                };
            }
            
            if (isNaN(limit) || limit < 1 || limit > 100) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid limit parameter (must be between 1 and 100)' })
                };
            }
            
            // 获取图片列表
            const { images, total } = getImages(page, limit, category);
            
            // 获取所有分类
            const categories = getCategories();
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    images,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit)
                    },
                    categories
                })
            };
        }
        
        // 处理POST请求 - 添加新图片
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const { url, filename, category, description } = body;
            
            if (!url || !filename) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'URL and filename are required' })
                };
            }
            
            const newImage = addImage({
                url,
                filename,
                category: category || 'uncategorized',
                description: description || '',
                uploadDate: new Date().toISOString()
            });
            
            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Image added successfully',
                    image: newImage
                })
            };
        }
        
        // 处理PUT请求 - 更新图片信息
        if (event.httpMethod === 'PUT') {
            const body = JSON.parse(event.body || '{}');
            const { id, url, filename, category, description } = body;
            
            if (!id) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Image ID is required' })
                };
            }
            
            const updatedImage = updateImage(id, {
                url,
                filename,
                category,
                description
            });
            
            if (!updatedImage) {
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
                    message: 'Image updated successfully',
                    image: updatedImage
                })
            };
        }
        
        // 处理DELETE请求 - 删除图片
        if (event.httpMethod === 'DELETE') {
            const body = JSON.parse(event.body || '{}');
            const { id } = body;
            
            if (!id) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Image ID is required' })
                };
            }
            
            const deletedImage = deleteImage(id);
            
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
        
        // 获取分类和统计信息
        if (queryParams.stats === 'true') {
            const stats = getStats();
            const categories = getCategories();
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    stats,
                    categories
                })
            };
        }
        
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    } catch (error) {
        console.error('Error handling images request:', error);
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