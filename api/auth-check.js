// 验证管理员令牌的API端点
const { verifyAdminToken } = require('./auth-middleware');

module.exports = async (req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // 只接受POST请求
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, message: '方法不允许' });
    }
    
    // 验证令牌
    const authResult = verifyAdminToken(req);
    
    if (authResult.valid) {
      return res.status(200).json({ 
        valid: true, 
        message: '令牌有效',
        payload: authResult.payload 
      });
    } else {
      return res.status(401).json({ 
        valid: false, 
        error: authResult.error || '令牌无效' 
      });
    }
  } catch (error) {
    console.error('Auth check error:', error);
    return res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
};