const https = require('https');
const { 
  getImages, 
  getImageByFileId, 
  getAllTelegramImages,
  getStats 
} = require('./kv-database');

module.exports = async (req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('检查同步状态...');
    
    // 获取数据库统计信息
    const stats = await getStats();
    console.log(`数据库中共有 ${stats.totalImages} 张图片`);
    
    // 获取所有Telegram图片
    const telegramImages = await getAllTelegramImages();
    console.log(`数据库中有 ${telegramImages.length} 张Telegram图片`);
    
    // 获取最新的几张图片（不限来源）
    const recentImages = await getImages(1, 10);
    console.log(`获取到 ${recentImages.images.length} 张最新图片`);
    
    // 分析图片来源
    const sourceAnalysis = {
      total: recentImages.images.length,
      telegram: 0,
      upload: 0,
      unknown: 0
    };
    
    const imageDetails = recentImages.images.map(img => {
      const isTelegram = !!img.fileId;
      if (isTelegram) {
        sourceAnalysis.telegram++;
      } else if (img.uploadPath) {
        sourceAnalysis.upload++;
      } else {
        sourceAnalysis.unknown++;
      }
      
      return {
        id: img.id,
        filename: img.filename,
        fileId: img.fileId || 'N/A',
        category: img.category || 'N/A',
        source: isTelegram ? 'Telegram' : (img.uploadPath ? 'Upload' : 'Unknown'),
        createdAt: new Date(img.createdAt).toISOString()
      };
    });
    
    // 返回详细状态
    res.status(200).json({
      success: true,
      message: '同步状态检查完成',
      stats: {
        totalImages: stats.totalImages,
        telegramImages: telegramImages.length
      },
      sourceAnalysis,
      recentImages: imageDetails,
      telegramImageDetails: telegramImages.map(img => ({
        id: img.id,
        fileId: img.fileId,
        category: img.category
      }))
    });
    
  } catch (error) {
    console.error('检查同步状态时发生错误:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};