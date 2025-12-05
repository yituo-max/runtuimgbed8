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

module.exports = async (req, res) => {
    // 设置CORS头
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // 处理预检请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // 验证管理员权限（除了GET请求）
    if (req.method !== 'GET') {
        const authResult = verifyAdminToken(req);
        if (!authResult.valid) {
            return res.status(authResult.statusCode).json({ error: authResult.error });
        }
    }
    
    try {
        // 处理GET请求 - 获取图片列表或单个图片
        if (req.method === 'GET') {
            // 检查是否有id参数，如果有则返回单个图片
            if (req.query.id) {
                const image = await getImage(req.query.id);
                if (!image) {
                    return res.status(404).json({ error: 'Image not found' });
                }
                return res.status(200).json({ success: true, image });
            }
            
            // 否则返回图片列表
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const category = req.query.category || '';
            
            // 验证参数
            if (isNaN(page) || page < 1) {
                return res.status(400).json({ error: 'Invalid page parameter' });
            }
            
            if (isNaN(limit) || limit < 1 || limit > 100) {
                return res.status(400).json({ error: 'Invalid limit parameter (must be between 1 and 100)' });
            }
            
            // 获取图片列表
            const { images, total } = await getImages(page, limit, category);
            
            // 获取所有分类
            const categories = await getCategories();
            
            return res.status(200).json({
                success: true,
                images,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                },
                categories
            });
        }
        
        // 处理POST请求 - 添加新图片
        if (req.method === 'POST') {
            const { url, filename, category, description } = req.body;
            
            if (!url || !filename) {
                return res.status(400).json({ error: 'URL and filename are required' });
            }
            
            const newImage = await addImage({
                url,
                filename,
                category: category || 'uncategorized',
                description: description || '',
                uploadDate: new Date().toISOString()
            });
            
            return res.status(201).json({
                success: true,
                message: 'Image added successfully',
                image: newImage
            });
        }
        
        // 处理PUT请求 - 更新图片信息
        if (req.method === 'PUT') {
            const { id, url, filename, category, description } = req.body;
            
            if (!id) {
                return res.status(400).json({ error: 'Image ID is required' });
            }
            
            const updatedImage = await updateImage(id, {
                url,
                filename,
                category,
                description
            });
            
            if (!updatedImage) {
                return res.status(404).json({ error: 'Image not found' });
            }
            
            return res.status(200).json({
                success: true,
                message: 'Image updated successfully',
                image: updatedImage
            });
        }
        
        // 处理DELETE请求 - 删除图片
        if (req.method === 'DELETE') {
            const { id } = req.body;
            
            if (!id) {
                return res.status(400).json({ error: 'Image ID is required' });
            }
            
            const deletedImage = await deleteImage(id);
            
            if (!deletedImage) {
                return res.status(404).json({ error: 'Image not found' });
            }
            
            return res.status(200).json({
                success: true,
                message: 'Image deleted successfully',
                deletedImage
            });
        }
        
        // 获取分类和统计信息
        if (req.query.stats === 'true') {
            const stats = getStats();
            const categories = getCategories();
            
            return res.status(200).json({
                success: true,
                stats,
                categories
            });
        }
        
        return res.status(405).json({ error: 'Method Not Allowed' });
    } catch (error) {
        console.error('Error handling images request:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
};