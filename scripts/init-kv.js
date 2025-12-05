// Vercel KV 数据库初始化脚本
// 此脚本用于在首次部署时初始化数据库结构

const { createClient } = require('@vercel/kv');

// 创建KV客户端
const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// 初始化数据库
async function initDatabase() {
  try {
    console.log('开始初始化KV数据库...');
    
    // 检查是否已经初始化
    const isInitialized = await kv.get('imgbed:initialized');
    
    if (isInitialized) {
      console.log('数据库已经初始化，跳过初始化步骤。');
      return;
    }
    
    // 初始化分类集合
    await kv.sadd('imgbed:categories', 'general');
    console.log('已创建默认分类：general');
    
    // 初始化统计信息
    await kv.hset('imgbed:stats', {
      totalImages: 0,
      totalCategories: 1,
      lastInitDate: new Date().toISOString()
    });
    console.log('已初始化统计信息');
    
    // 设置初始化标记
    await kv.set('imgbed:initialized', 'true');
    console.log('已设置初始化标记');
    
    console.log('KV数据库初始化完成！');
  } catch (error) {
    console.error('初始化KV数据库时出错:', error);
    throw error;
  }
}

// 重置数据库（谨慎使用）
async function resetDatabase() {
  try {
    console.log('警告：正在重置KV数据库...');
    
    // 获取所有图片ID
    const imageIds = await kv.zrange('imgbed:images', 0, -1);
    
    // 删除所有图片数据
    if (imageIds && imageIds.length > 0) {
      const imageKeys = imageIds.map(id => `imgbed:image:${id}`);
      await kv.del(imageKeys);
      console.log(`已删除 ${imageKeys.length} 个图片记录`);
    }
    
    // 删除索引和集合
    await kv.del('imgbed:images');
    await kv.del('imgbed:categories');
    await kv.del('imgbed:stats');
    await kv.del('imgbed:initialized');
    
    console.log('KV数据库已重置');
    
    // 重新初始化
    await initDatabase();
  } catch (error) {
    console.error('重置KV数据库时出错:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'init') {
    initDatabase()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else if (command === 'reset') {
    resetDatabase()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    console.log('用法:');
    console.log('  node init-kv.js init   - 初始化数据库');
    console.log('  node init-kv.js reset  - 重置数据库（会删除所有数据）');
    process.exit(1);
  }
}

module.exports = {
  initDatabase,
  resetDatabase
};