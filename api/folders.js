// 文件夹管理API
const { createClient } = require('@vercel/kv');

// 创建KV客户端
const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// 键名前缀
const FOLDERS_KEY = 'imgbed:folders';

// 获取所有文件夹
async function getFolders() {
  try {
    const foldersData = await kv.get(FOLDERS_KEY);
    return foldersData ? JSON.parse(foldersData) : [];
  } catch (error) {
    console.error('Error getting folders:', error);
    return [];
  }
}

// 创建新文件夹
async function createFolder(name, parentId = null) {
  try {
    const folders = await getFolders();
    const newFolder = {
      id: 'folder_' + Date.now(),
      name: name,
      parentId: parentId,
      createdAt: new Date().toISOString()
    };
    
    folders.push(newFolder);
    await kv.set(FOLDERS_KEY, JSON.stringify(folders));
    
    return newFolder;
  } catch (error) {
    console.error('Error creating folder:', error);
    return null;
  }
}

// 确保必要的文件夹存在
async function ensureFoldersExist() {
  try {
    const folders = await getFolders();
    const requiredFolders = [
      { id: 'avatar', name: '头像', parentId: null },
      { id: 'chat', name: '聊天', parentId: null }
    ];
    
    for (const requiredFolder of requiredFolders) {
      const exists = folders.some(f => f.id === requiredFolder.id);
      if (!exists) {
        await createFolder(requiredFolder.name, requiredFolder.parentId);
        console.log(`创建必要文件夹: ${requiredFolder.name} (${requiredFolder.id})`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring folders exist:', error);
    return false;
  }
}

module.exports = {
  getFolders,
  createFolder,
  ensureFoldersExist
};