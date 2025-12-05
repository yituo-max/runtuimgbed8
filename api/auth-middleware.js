const crypto = require('crypto');

// 管理员凭据（在实际生产环境中应该使用环境变量）
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '520911zxc';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 生成JWT令牌
function generateJWT(payload) {
    // 创建头部
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };
    
    // 设置过期时间为24小时
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (24 * 60 * 60); // 24小时
    
    // 添加过期时间到payload
    const tokenPayload = {
        ...payload,
        iat: now,
        exp: exp
    };
    
    // Base64Url编码头部和载荷
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
    
    // 创建签名
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(signatureInput)
        .digest('base64url');
    
    // 组合JWT
    return `${signatureInput}.${signature}`;
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

// Base64Url编码
function base64UrlEncode(str) {
    return Buffer.from(str)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// Base64Url解码
function base64UrlDecode(str) {
    // 添加填充字符
    str += new Array(5 - str.length % 4).join('=');
    return Buffer.from(str.replace(/\-/g, '+').replace(/_/g, '/'), 'base64').toString();
}

// 验证管理员凭据
function verifyAdminCredentials(username, password) {
    return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

// 验证管理员令牌中间件
function verifyAdminToken(req) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { 
                valid: false, 
                statusCode: 401, 
                error: 'Authorization header is missing or invalid' 
            };
        }
        
        const token = authHeader.substring(7);
        const verification = verifyJWT(token);
        
        if (!verification.valid) {
            return { 
                valid: false, 
                statusCode: 401, 
                error: verification.error 
            };
        }
        
        // 检查是否为管理员
        if (verification.payload.role !== 'admin') {
            return { 
                valid: false, 
                statusCode: 403, 
                error: 'Access denied: Admin role required' 
            };
        }
        
        return { valid: true, payload: verification.payload };
    } catch (error) {
        return { 
            valid: false, 
            statusCode: 500, 
            error: error.message 
        };
    }
}

// 导出验证函数供其他模块使用
module.exports = {
    generateJWT,
    verifyJWT,
    verifyAdminCredentials,
    verifyAdminToken
};