const { verifyAdminToken } = require('./auth-middleware');
const { getStats } = require('./kv-database');

exports.handler = async function(event, context) {
  // 设置CORS头
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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
    const queryParams = event.queryStringParameters || {};
    
    // 获取统计信息
    if (queryParams.stats === 'true') {
      const stats = await getStats();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: stats
        })
      };
    }
    
    // 默认测试响应
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "API is working!",
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Test API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Internal server error'
      })
    };
  }
};