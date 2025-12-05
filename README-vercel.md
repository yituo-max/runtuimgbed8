# Telegram图床服务 - Vercel部署版本

这是一个基于Telegram的图床服务，已适配Vercel平台部署，使用Vercel KV作为数据存储。

## 功能特点

- 通过Telegram Bot API存储图片
- 使用Vercel KV进行数据持久化存储
- 管理员认证系统
- 图片分类管理
- 分页浏览
- 响应式设计

## 部署到Vercel

### 1. 准备工作

1. 创建一个Telegram Bot：
   - 与@BotFather对话创建新机器人
   - 获取Bot Token

2. 准备一个Telegram聊天ID：
   - 可以是个人聊天ID或群组ID
   - 使用@userinfobot获取个人ID

3. 注册Vercel账号：
   - 访问 [vercel.com](https://vercel.com) 注册账号

4. 创建Vercel KV数据库：
   - 在Vercel控制台中，进入项目设置
   - 点击"Storage"选项卡
   - 创建新的KV数据库
   - 记录数据库的REST API URL和Token

### 2. 部署步骤

#### 方法一：通过Vercel CLI部署

1. 安装Vercel CLI：
   ```bash
   npm i -g vercel
   ```

2. 在项目目录中运行：
   ```bash
   vercel
   ```

3. 按照提示配置项目：
   - 选择团队（个人或组织）
   - 设置项目名称
   - 确认部署设置

4. 配置环境变量：
   ```bash
   vercel env add TELEGRAM_BOT_TOKEN
   vercel env add TELEGRAM_CHAT_ID
   vercel env add ADMIN_USERNAME
   vercel env add ADMIN_PASSWORD
   vercel env add JWT_SECRET
   vercel env add KV_REST_API_URL
   vercel env add KV_REST_API_TOKEN
   ```

#### 方法二：通过GitHub集成部署

1. 将代码推送到GitHub仓库

2. 在Vercel中导入项目：
   - 点击"New Project"
   - 选择GitHub仓库
   - 配置项目设置

3. 在Vercel控制台中设置环境变量

### 3. 环境变量配置

在Vercel项目中设置以下环境变量：

- `TELEGRAM_BOT_TOKEN`: Telegram机器人令牌
- `TELEGRAM_CHAT_ID`: 存储图片的聊天ID
- `ADMIN_USERNAME`: 管理员用户名
- `ADMIN_PASSWORD`: 管理员密码
- `JWT_SECRET`: JWT签名密钥（建议使用随机字符串）
- `KV_REST_API_URL`: Vercel KV数据库的REST API URL
- `KV_REST_API_TOKEN`: Vercel KV数据库的访问令牌
- `SITE_URL`: 网站URL（可选，默认为https://your-site.vercel.app）

### 4. 使用说明

1. 访问部署后的网站
2. 使用管理员凭据登录
3. 上传图片到图床
4. 管理已上传的图片

## API端点

- `POST /api/admin-login`: 管理员登录
- `GET /api/images-list`: 获取图片列表
- `POST /api/upload`: 上传图片
- `GET /api/image?id={id}`: 获取单个图片信息
- `DELETE /api/image?id={id}`: 删除图片
- `GET /api/serve-image?id={id}`: 访问图片文件
- `GET /api/test`: API测试端点

## Vercel KV 数据结构

本应用使用Vercel KV存储以下数据：

1. 图片信息：
   - 键格式：`imgbed:image:{id}`
   - 值：JSON格式的图片信息

2. 图片ID列表（按时间排序）：
   - 键：`imgbed:images`
   - 类型：有序集合（ZSET）

3. 分类列表：
   - 键：`imgbed:categories`
   - 类型：集合（SET）

4. 统计信息：
   - 键：`imgbed:stats`
   - 类型：哈希（HASH）

## 注意事项

1. Vercel免费版限制：
   - 100GB带宽/月
   - 函数执行时间限制（10秒）
   - 函数内存限制（1GB）
   - KV数据库：30,000次请求/天，1GB存储

2. Telegram Bot限制：
   - 单个文件最大20MB
   - 每秒最多30次消息

3. 安全建议：
   - 使用强密码和JWT密钥
   - 定期更新管理员凭据
   - 考虑添加IP白名单

## 故障排除

1. 上传失败：
   - 检查Telegram Bot Token是否正确
   - 确认聊天ID有效
   - 验证文件大小是否超限

2. 认证问题：
   - 检查管理员凭据
   - 确认JWT密钥设置正确

3. 数据持久化问题：
   - 检查KV_REST_API_URL和KV_REST_API_TOKEN是否正确
   - 确认KV数据库已正确创建并连接

4. 性能问题：
   - 考虑添加图片缓存
   - 优化图片大小和格式

## 技术栈

- 前端：HTML, CSS, JavaScript
- 后端：Node.js (Vercel Functions)
- 存储：Telegram Bot API + Vercel KV
- 部署平台：Vercel