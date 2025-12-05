const { verifyAdminToken } = require('./auth-middleware');
const { getImage, deleteImage } = require('./kv-database');

module.exports = async (req, res) => {
    // 设置CORS头
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
    
    // 处理预检请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // 只接受GET和DELETE请求
    if (req.method !== 'GET' && req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    // 验证管理员权限
    const authResult = verifyAdminToken(req);
    if (!authResult.valid) {
        return res.status(authResult.statusCode).json({ error: authResult.error });
    }
    
    try {
        // 从查询参数获取图片ID
        const imageId = req.query.id;
        
        if (!imageId) {
            return res.status(400).json({ error: 'Image ID is required' });
        }
        
        // 获取图片信息
        const image = await getImage(imageId);
        
        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }
        
        // 处理GET请求 - 获取图片信息
        if (req.method === 'GET') {
            // 检查是否有serve参数，如果有则重定向到图片URL
            if (req.query.serve === 'true') {
                // 重定向到实际的图片URL
                return res.redirect(302, image.url);
            }
            
            return res.status(200).json({
                success: true,
                image
            });
        }
        
        // 处理DELETE请求 - 删除图片
        if (req.method === 'DELETE') {
            const deletedImage = await deleteImage(imageId);
            
            if (!deletedImage) {
                return res.status(404).json({ error: 'Image not found' });
            }
            
            return res.status(200).json({
                success: true,
                message: 'Image deleted successfully',
                deletedImage
            });
        }
    } catch (error) {
        console.error('Error handling image request:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
};