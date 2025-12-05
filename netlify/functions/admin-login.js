const crypto = require('crypto');

// 管理员凭据（在实际生产环境中应该使用环境变量）
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
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

exports.handler = async function(event, context) {
    // 设置CORS头
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    
    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers
        };
    }
    
    // 只接受POST请求
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }
    
    try {
        // 解析请求体
        const { username, password } = JSON.parse(event.body);
        
        if (!username || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Username and password are required' })
            };
        }
        
        // 验证管理员凭据
        if (!verifyAdminCredentials(username, password)) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Invalid credentials' })
            };
        }
        
        // 生成JWT令牌
        const token = generateJWT({ 
            username, 
            role: 'admin' 
        });
        
        // 返回令牌
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                token,
                expiresIn: '24h'
            })
        };
    } catch (error) {
        console.error('Login error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
};

// 导出验证函数供其他模块使用
module.exports = {
    generateJWT,
    verifyJWT,
    verifyAdminCredentials
};