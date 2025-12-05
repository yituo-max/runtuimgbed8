# RuntuImgBed 4.0 - Telegram图片托管服务

## 项目概述

RuntuImgBed 4.0 是一个基于Telegram Bot API的图片托管服务，提供简单、高效的图片上传、存储和管理功能。该项目支持本地部署和云端部署（Vercel/Netlify），具有暗夜风半透明UI设计，支持文件夹分类管理和权限控制。

## 主要功能

- **图片上传与托管**：通过Telegram Bot API实现图片的云端存储
- **权限管理**：区分管理员和普通用户，管理员可查看所有图片链接
- **文件夹管理**：支持创建、重命名、删除文件夹，实现图片分类存储
- **分类标签**：为图片添加分类标签，便于管理和检索
- **搜索与筛选**：支持按名称搜索和按分类筛选图片
- **多种链接格式**：提供直接链接、Markdown格式和HTML格式的图片链接
- **暗夜风UI**：采用现代化的暗夜风半透明设计，提供良好的用户体验
- **响应式设计**：适配不同屏幕尺寸的设备

## 技术栈

- **前端**：HTML5、CSS3、JavaScript (ES6+)
- **后端**：Node.js、Express
- **数据库**：Vercel KV (Redis) 或 本地存储
- **云存储**：Telegram Bot API
- **部署平台**：Vercel、Netlify 或 本地服务器

## 项目结构

```
runtuimgbed4.0/
├── api/                     # 后端API文件
│   ├── admin-login.js      # 管理员登录API
│   ├── auth-check.js       # 权限检查API
│   ├── auth-middleware.js  # 认证中间件
│   ├── image.js            # 单个图片操作API
│   ├── images-list.js      # 图片列表API
│   ├── images.js           # 图片操作API
│   ├── init-kv.js          # KV数据库初始化
│   ├── kv-database.js      # KV数据库操作
│   ├── serve-image.js      # 图片服务API
│   ├── test.js             # 测试API
│   └── upload.js           # 图片上传API
├── img/                    # 本地图片资源
├── netlify/                # Netlify函数
├── scripts/                # 脚本文件
├── index.html              # 主页面文件
├── local-server.js         # 本地服务器
├── package.json            # 项目依赖配置
├── vercel.json             # Vercel部署配置
└── netlify.toml            # Netlify部署配置
```

## 核心文件说明

### index.html

项目的主要前端文件，包含完整的HTML结构、CSS样式和JavaScript代码：

- **UI设计**：采用暗夜风半透明设计，使用深色背景和半透明元素
- **功能模块**：
  - 管理员登录界面
  - 图片上传区域（支持拖放和选择文件）
  - 图片库展示（支持文件夹和分类管理）
  - 分类管理界面
- **交互功能**：
  - 图片预览和上传进度显示
  - 文件夹创建、重命名和删除
  - 图片移动到文件夹
  - 分类标签管理
  - 搜索和筛选功能

### local-server.js

本地开发服务器，提供以下功能：

- Express服务器配置
- CORS和JSON解析中间件
- 静态文件服务
- API路由配置
- 图片文件服务

### api/upload.js

图片上传核心API，实现以下功能：

- 使用formidable解析multipart/form-data
- 请求频率限制（每分钟最多10次请求）
- 图片上传到Telegram Bot API
- 文件大小限制（最大5MB）
- 管理员权限验证
- 图片信息保存到KV数据库

### api/kv-database.js

Vercel KV数据库操作模块，提供以下功能：

- 图片的增删改查操作
- 分类管理
- 统计信息更新
- 分页支持

### api/auth-middleware.js

认证中间件，提供以下功能：

- JWT令牌生成和验证
- 管理员凭据验证
- 权限控制

## 部署方式

### 本地部署

1. 安装依赖：
```bash
npm install
```

2. 配置环境变量（创建.env文件）：
```
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
```

3. 启动本地服务器：
```bash
node local-server.js
```

4. 访问 http://localhost:3000

### Vercel部署

1. 在Vercel控制台创建新项目
2. 连接GitHub仓库或上传项目文件
3. 配置环境变量：
   - TELEGRAM_BOT_TOKEN
   - TELEGRAM_CHAT_ID
   - ADMIN_USERNAME
   - ADMIN_PASSWORD
   - JWT_SECRET
   - KV_REST_API_URL
   - KV_REST_API_TOKEN

4. 部署项目

### Netlify部署

1. 在Netlify控制台创建新站点
2. 连接GitHub仓库或上传项目文件
3. 配置环境变量
4. 部署项目

## 环境变量配置

| 变量名 | 描述 | 必需 |
|--------|------|------|
| TELEGRAM_BOT_TOKEN | Telegram机器人令牌 | 是 |
| TELEGRAM_CHAT_ID | Telegram聊天ID | 是 |
| ADMIN_USERNAME | 管理员用户名 | 是 |
| ADMIN_PASSWORD | 管理员密码 | 是 |
| JWT_SECRET | JWT签名密钥 | 是 |
| KV_REST_API_URL | Vercel KV REST API URL | Vercel部署必需 |
| KV_REST_API_TOKEN | Vercel KV REST API令牌 | Vercel部署必需 |
| SITE_URL | 网站URL | 否 |

## 使用说明

### 管理员操作

1. 登录管理员账户
2. 上传图片并自动保存到图片库
3. 创建文件夹进行分类管理
4. 为图片添加分类标签
5. 搜索和筛选图片
6. 复制不同格式的图片链接

### 普通用户操作

1. 上传图片（不保存到图片库）
2. 查看上传成功提示
3. 登录后可查看图片链接

## 技术特点

1. **无服务器架构**：使用Vercel/Netlify的无服务器函数，无需维护服务器
2. **云端存储**：利用Telegram作为图片存储，节省存储成本
3. **权限控制**：基于JWT的身份验证和权限管理
4. **响应式设计**：适配各种设备屏幕
5. **暗夜风UI**：现代化的暗夜风半透明设计
6. **文件夹管理**：支持多级文件夹结构
7. **分类标签**：灵活的分类系统

## 开发与扩展

### 添加新功能

1. 在相应的API文件中添加后端逻辑
2. 在index.html中添加前端界面和交互
3. 更新样式和响应式设计

### 自定义样式

主要样式变量定义在index.html的CSS部分：

```css
:root {
    --primary-color: #5e72e4;
    --secondary-color: #2dce89;
    --danger-color: #f5365c;
    --warning-color: #fb6340;
    --info-color: #11cdef;
    --dark-color: #172b4d;
    --light-color: #f4f5f7;
    /* ...更多样式变量 */
}
```

### API扩展

在api目录下创建新的API文件，遵循现有的模块化结构。

## 注意事项

1. 确保Telegram Bot Token和Chat ID的正确配置
2. 在生产环境中使用强密码和安全的JWT密钥
3. 定期备份KV数据库中的图片信息
4. 注意Telegram API的请求限制

## 许可证

本项目采用MIT许可证，详见LICENSE文件。

## 贡献

欢迎提交Issue和Pull Request来改进项目。

## 联系方式

如有问题或建议，请通过GitHub Issues联系。