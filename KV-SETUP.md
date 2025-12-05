# Vercel KV 配置指南

您的项目已成功部署到Vercel，但还需要配置Vercel KV数据库以实现数据持久化存储。

## 步骤1：通过Vercel Marketplace创建KV数据库

### 方法1：通过Vercel控制台

1. 登录到 [Vercel控制台](https://vercel.com/dashboard)
2. 选择您的项目 `runtu_imgbed2.0`
3. 点击顶部菜单栏中的 "Storage" 选项卡
4. 点击 "Create Database" 按钮
5. 在弹出的窗口中选择 "Upstash Redis KV" (而不是直接选择KV)
6. 点击 "Continue"
7. 选择地区（推荐选择新加坡或日本以获得更好的延迟）
8. 点击 "Create"

### 方法2：通过Vercel Marketplace

1. 登录到 [Vercel控制台](https://vercel.com/dashboard)
2. 点击左侧导航栏中的 "Marketplace" 选项
3. 在搜索框中输入 "KV" 或 "Upstash"
4. 找到 "KV by Upstash" 并点击
5. 点击 "Add to Project" 按钮
6. 选择您的项目 `runtu_imgbed2.0`
7. 点击 "Continue"
8. 选择地区（推荐选择新加坡或日本）
9. 点击 "Create"

## 步骤2：获取KV数据库凭证

1. 在KV数据库页面，点击 "Connect" 按钮
2. 选择 "Framework" 为 "Other"
3. 复制显示的 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN`

## 步骤3：配置环境变量

### 方法1：通过Vercel控制台

1. 在项目页面，点击 "Settings" 选项卡
2. 点击 "Environment Variables"
3. 添加以下环境变量：
   - `KV_REST_API_URL`: 步骤2中复制的URL
   - `KV_REST_API_TOKEN`: 步骤2中复制的Token

### 方法2：通过Vercel CLI

```bash
# 添加KV REST API URL
vercel env add KV_REST_API_URL

# 添加KV REST API Token
vercel env add KV_REST_API_TOKEN
```

## 步骤4：重新部署项目

```bash
vercel --prod
```

## 步骤5：初始化KV数据库

部署完成后，您需要初始化KV数据库结构。您可以通过以下方式之一完成：

### 方法1：通过API端点

访问您的部署URL，然后访问 `/api/test` 端点，这将自动初始化数据库。

### 方法2：通过本地脚本

```bash
# 设置环境变量
export KV_REST_API_URL=your_kv_rest_api_url
export KV_REST_API_TOKEN=your_kv_rest_api_token

# 运行初始化脚本
npm run init-kv
```

## 验证配置

1. 访问您的部署URL
2. 使用管理员凭据登录（用户名：admin，密码：520911zxc）
3. 尝试上传一张图片
4. 刷新页面，确认图片仍然存在

## 故障排除

如果遇到问题，请检查：

1. 环境变量是否正确设置
2. KV数据库是否已创建并连接
3. 网络连接是否正常

您可以通过以下命令检查部署状态：

```bash
vercel inspect [您的部署URL] --logs
```

## 当前部署信息

- 部署URL: https://runtuimgbed20-3px4k394k-r-zs-projects-83e4b1bf.vercel.app
- 项目名称: runtu_imgbed2.0
- 团队: r-zs-projects-83e4b1bf