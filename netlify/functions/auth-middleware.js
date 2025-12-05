const crypto = require('crypto');

// JWT密钥（与admin-login.js中保持一致）
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Base64Url解码
function base64UrlDecode(str) {
    // 添加填充字符
    str += new Array(5 - str.length % 4).join('=');
    return Buffer.from(str.replace(/\-/g, '+').replace(/_/g, '/'), 'base64').toString();
}

// 验证JWT令牌
function verifyJWT(token) {
    try {
        // 分割JWT
        const parts = token.split('.');
        if (parts.length !== 3) {
            return { valid: false, error: 'Invalid token format' };
        }
        
        const [encodedHeader, encodedPayload, signature] = parts;
        
        // 验证签名
        const signatureInput = `${encodedHeader}.${encodedPayload}`;
        const expectedSignature = crypto
            .createHmac('sha256', JWT_SECRET)
            .update(signatureInput)
            .digest('base64url');
        
        if (signature !== expectedSignature) {
            return { valid: false, error: 'Invalid signature' };
        }
        
        // 解码载荷
        const payload = JSON.parse(base64UrlDecode(encodedPayload));
        
        // 检查过期时间
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return { valid: false, error: 'Token expired' };
        }
        
        return { valid: true, payload };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

// 验证管理员令牌的中间件函数
function verifyAdminToken(event) {
    try {
        // 从请求头获取Authorization
        const authHeader = event.headers.authorization || event.headers.Authorization;
        
        if (!authHeader) {
            return { 
                valid: false, 
                error: 'Authorization header is missing',
                statusCode: 401
            };
        }
        
        // 检查Bearer前缀
        if (!authHeader.startsWith('Bearer ')) {
            return { 
                valid: false, 
                error: 'Invalid authorization header format',
                statusCode: 401
            };
        }
        
        // 提取令牌
        const token = authHeader.substring(7);
        
        // 验证JWT
        const result = verifyJWT(token);
        
        if (!result.valid) {
            return { 
                valid: false, 
                error: result.error,
                statusCode: 401
            };
        }
        
        // 检查是否为管理员
        if (result.payload.role !== 'admin') {
            return { 
                valid: false, 
                error: 'Access denied: admin role required',
                statusCode: 403
            };
        }
        
        return { 
            valid: true, 
            payload: result.payload 
        };
    } catch (error) {
        return { 
            valid: false, 
            error: error.message,
            statusCode: 500
        };
    }
}

// 导出验证函数
module.exports = {
    verifyAdminToken,
    verifyJWT
};