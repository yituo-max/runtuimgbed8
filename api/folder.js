// 文件夹API端点
const { getFolders, createFolder } = require('./folders');
const { verifyAdminToken } = require('./auth-middleware');

module.exports = async (req, res) => {
    // 设置CORS头
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    
    // 处理预检请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        // 获取所有文件夹
        if (req.method === 'GET') {
            const folders = await getFolders();
            return res.status(200).json({
                success: true,
                folders: folders
            });
        }
        
        // 创建新文件夹
        if (req.method === 'POST') {
            // 验证管理员权限
            const authResult = verifyAdminToken(req);
            if (!authResult.valid) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            
            const { name, parentId } = req.body;
            
            if (!name || name.trim() === '') {
                return res.status(400).json({ error: 'Folder name is required' });
            }
            
            const newFolder = await createFolder(name.trim(), parentId || null);
            
            if (!newFolder) {
                return res.status(500).json({ error: 'Failed to create folder' });
            }
            
            return res.status(201).json({
                success: true,
                message: 'Folder created successfully',
                folder: newFolder
            });
        }
        
        // 其他方法暂不支持
        return res.status(405).json({ error: 'Method Not Allowed' });
        
    } catch (error) {
        console.error('Folders API error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
};