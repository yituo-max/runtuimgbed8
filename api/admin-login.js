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

// Base64Url编码
function base64UrlEncode(str) {
    return Buffer.from(str)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// 验证管理员凭据
function verifyAdminCredentials(username, password) {
    return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

module.exports = async (req, res) => {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    
    // 处理预检请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // 只接受POST请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    try {
        // 解析请求体
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        // 验证管理员凭据
        if (!verifyAdminCredentials(username, password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // 生成JWT令牌
        const token = generateJWT({ 
            username, 
            role: 'admin' 
        });
        
        // 返回令牌
        return res.status(200).json({
            success: true,
            token,
            expiresIn: '24h'
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
};