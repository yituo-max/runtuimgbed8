const { verifyAdminToken } = require('./auth-middleware');
const { getStats } = require('./kv-database');

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
    
    try {
        // 处理GET请求 - 测试API状态
        if (req.method === 'GET') {
            // 检查是否需要初始化KV数据库
            if (req.query.init === 'true') {
                // 验证管理员权限
                const authResult = verifyAdminToken(req);
                if (!authResult.valid) {
                    return res.status(authResult.statusCode).json({ error: authResult.error });
                }
                
                // 初始化KV数据库
                const kv = require('@vercel/kv');
                
                // 检查是否已经初始化
                const initialized = await kv.get('imgbed:initialized');
                
                if (initialized) {
                    return res.status(200).json({
                        success: true,
                        message: 'KV database already initialized',
                        initialized: true
                    });
                }
                
                // 初始化分类集合
                await kv.set('imgbed:categories', JSON.stringify(['uncategorized']));
                
                // 初始化统计信息
                await kv.set('imgbed:stats', JSON.stringify({
                    totalImages: 0,
                    totalSize: 0,
                    lastUpdated: new Date().toISOString()
                }));
                
                // 设置初始化标记
                await kv.set('imgbed:initialized', 'true');
                
                return res.status(200).json({
                    success: true,
                    message: 'KV database initialized successfully',
                    initialized: true
                });
            }
            
            // 获取统计信息
            if (req.query.stats === 'true') {
                const stats = await getStats();
                return res.status(200).json({
                    success: true,
                    stats
                });
            }
            
            // 默认测试响应
            return res.status(200).json({
                success: true,
                message: 'API is working',
                timestamp: new Date().toISOString(),
                method: req.method,
                url: req.url,
                headers: req.headers
            });
        }
        
        // 处理POST请求 - 执行测试操作
        if (req.method === 'POST') {
            // 验证管理员权限
            const authResult = verifyAdminToken(req);
            if (!authResult.valid) {
                return res.status(authResult.statusCode).json({ error: authResult.error });
            }
            
            const { action } = req.body;
            
            if (action === 'ping') {
                return res.status(200).json({
                    success: true,
                    message: 'Pong!',
                    timestamp: new Date().toISOString()
                });
            }
            
            return res.status(400).json({
                success: false,
                message: 'Unknown action'
            });
        }
        
        // 其他方法不允许
        return res.status(405).json({
            success: false,
            message: 'Method Not Allowed'
        });
    } catch (error) {
        console.error('Test API error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};