// Netlify Functions版本的刷新管理员令牌端点
const { verifyAdminToken, generateJWT } = require('./auth-middleware');

exports.handler = async (event, context) => {
  // 设置CORS头
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
  
  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }
  
  try {
    // 只接受POST请求
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ success: false, message: '方法不允许' })
      };
    }
    
    // 模拟请求对象以使用现有的中间件
    const mockReq = {
      headers: {
        authorization: event.headers.authorization || ''
      }
    };
    
    // 验证当前令牌
    const authResult = verifyAdminToken(mockReq);
    
    if (authResult.valid) {
      // 生成新的令牌
      const newToken = generateJWT({ 
        username: authResult.payload.username, 
        role: 'admin' 
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: '令牌已刷新',
          token: newToken,
          expiresIn: '24h'
        })
      };
    } else {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: authResult.error || '令牌无效' 
        })
      };
    }
  } catch (error) {
    console.error('Token refresh error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: '服务器错误' 
      })
    };
  }
};