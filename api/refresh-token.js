// 刷新管理员令牌的API端点
const { verifyAdminToken, generateJWT } = require('./auth-middleware');

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
    
    // 验证当前令牌
    const authResult = verifyAdminToken(req);
    
    if (authResult.valid) {
      // 生成新的令牌
      const newToken = generateJWT({ 
        username: authResult.payload.username, 
        role: 'admin' 
      });
      
      return res.status(200).json({ 
        success: true, 
        message: '令牌已刷新',
        token: newToken,
        expiresIn: '24h'
      });
    } else {
      return res.status(401).json({ 
        success: false, 
        message: authResult.error || '令牌无效' 
      });
    }
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
};