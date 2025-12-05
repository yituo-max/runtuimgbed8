// Vercel KV数据库连接模块
const { createClient } = require('@vercel/kv');

// 创建KV客户端
const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// 键名前缀
const IMAGE_KEY_PREFIX = 'imgbed:image:';
const CATEGORIES_KEY = 'imgbed:categories';
const STATS_KEY = 'imgbed:stats';

// 获取所有图片（支持分页和分类过滤）
async function getImages(page = 1, limit = 10, category = null) {
  try {
    // 获取所有图片ID
    const imageIds = await kv.zrange('imgbed:images', 0, -1, { rev: true }); // 按分数降序（最新在前）
    
    if (!imageIds || imageIds.length === 0) {
      return {
        images: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      };
    }

    // 批量获取图片数据
    const imageKeys = imageIds.map(id => `${IMAGE_KEY_PREFIX}${id}`);
    const imagesData = await kv.mget(imageKeys);
    
    // 过滤并格式化图片数据
    let images = imagesData
      .filter(img => img !== null)
      .map(img => typeof img === 'string' ? JSON.parse(img) : img);
    
    // 如果指定了分类，进行过滤
    if (category) {
      images = images.filter(img => img.category === category);
    }
    
    // 计算分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    
    // 获取分页后的图片
    const paginatedImages = images.slice(startIndex, endIndex);
    
    // 返回结果
    return {
      images: paginatedImages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: images.length,
        pages: Math.ceil(images.length / limit)
      }
    };
  } catch (error) {
    console.error('Error getting images:', error);
    // 如果KV不可用，返回空结果
    return {
      images: [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0,
        pages: 0
      }
    };
  }
}

// 根据ID获取单个图片
async function getImage(id) {
  try {
    const imageData = await kv.get(`${IMAGE_KEY_PREFIX}${id}`);
    return imageData ? (typeof imageData === 'string' ? JSON.parse(imageData) : imageData) : null;
  } catch (error) {
    console.error('Error getting image:', error);
    return null;
  }
}

// 根据fileId获取图片
async function getImageByFileId(fileId) {
  try {
    console.log(`getImageByFileId: 查找fileId=${fileId}`);
    // 获取所有图片ID
    const imageIds = await kv.zrange('imgbed:images', 0, -1);
    
    if (!imageIds || imageIds.length === 0) {
      console.log('getImageByFileId: 没有找到任何图片ID');
      return null;
    }

    console.log(`getImageByFileId: 找到${imageIds.length}个图片ID`);
    
    // 批量获取图片数据
    const imageKeys = imageIds.map(id => `${IMAGE_KEY_PREFIX}${id}`);
    const imagesData = await kv.mget(imageKeys);
    
    // 查找匹配fileId的图片
    for (const imgData of imagesData) {
      if (imgData) {
        const image = typeof imgData === 'string' ? JSON.parse(imgData) : imgData;
        console.log(`getImageByFileId: 比较图片fileId=${image.fileId} 与 查找fileId=${fileId}`);
        if (image.fileId === fileId) {
          console.log(`getImageByFileId: 找到匹配的图片`);
          return image;
        }
      }
    }
    
    console.log(`getImageByFileId: 未找到匹配的图片`);
    return null;
  } catch (error) {
    console.error('Error getting image by fileId:', error);
    return null;
  }
}

// 添加新图片
async function addImage(imageData) {
  try {
    const id = Date.now().toString();
    const newImage = {
      id,
      ...imageData,
      uploadDate: new Date().toISOString()
    };
    
    // 存储图片数据
    await kv.set(`${IMAGE_KEY_PREFIX}${id}`, JSON.stringify(newImage));
    
    // 添加到有序集合（用于排序，使用时间戳作为分数）
    await kv.zadd('imgbed:images', { score: Date.now(), member: id });
    
    // 更新分类列表
    await updateCategories(imageData.category);
    
    // 更新统计信息
    await updateStats('increment');
    
    return newImage;
  } catch (error) {
    console.error('Error adding image:', error);
    return null;
  }
}

// 更新图片信息
async function updateImage(id, updateData) {
  try {
    const existingImage = await getImage(id);
    
    if (!existingImage) {
      return null;
    }
    
    const updatedImage = {
      ...existingImage,
      ...updateData
    };
    
    // 更新图片数据
    await kv.set(`${IMAGE_KEY_PREFIX}${id}`, JSON.stringify(updatedImage));
    
    // 如果分类发生变化，更新分类列表
    if (updateData.category && updateData.category !== existingImage.category) {
      await updateCategories(updateData.category);
      // 注意：这里没有从旧分类中移除，实际应用中可能需要更复杂的逻辑
    }
    
    return updatedImage;
  } catch (error) {
    console.error('Error updating image:', error);
    return null;
  }
}

// 删除图片
async function deleteImage(id) {
  try {
    const existingImage = await getImage(id);
    
    if (!existingImage) {
      return null;
    }
    
    // 删除图片数据
    await kv.del(`${IMAGE_KEY_PREFIX}${id}`);
    
    // 从有序集合中移除
    await kv.zrem('imgbed:images', id);
    
    // 更新统计信息
    await updateStats('decrement');
    
    return existingImage;
  } catch (error) {
    console.error('Error deleting image:', error);
    return null;
  }
}

// 获取所有分类
async function getCategories() {
  try {
    const categories = await kv.smembers(CATEGORIES_KEY);
    return categories.filter(cat => cat); // 过滤掉空值
  } catch (error) {
    console.error('Error getting categories:', error);
    return [];
  }
}

// 更新分类列表
async function updateCategories(category) {
  if (!category) return;
  
  try {
    await kv.sadd(CATEGORIES_KEY, category);
  } catch (error) {
    console.error('Error updating categories:', error);
  }
}

// 更新统计信息
async function updateStats(action) {
  try {
    const stats = await kv.hgetall(STATS_KEY) || { totalImages: 0 };
    
    if (action === 'increment') {
      stats.totalImages = (parseInt(stats.totalImages) || 0) + 1;
    } else if (action === 'decrement') {
      stats.totalImages = Math.max((parseInt(stats.totalImages) || 0) - 1, 0);
    }
    
    await kv.hset(STATS_KEY, stats);
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

// 获取统计信息
async function getStats() {
  try {
    return await kv.hgetall(STATS_KEY) || { totalImages: 0 };
  } catch (error) {
    console.error('Error getting stats:', error);
    return { totalImages: 0 };
  }
}

// 获取所有Telegram图片（包含fileId字段）
async function getAllTelegramImages() {
  try {
    console.log('获取所有Telegram图片...');
    // 获取所有图片ID
    const imageIds = await kv.zrange('imgbed:images', 0, -1);
    
    if (!imageIds || imageIds.length === 0) {
      console.log('没有找到任何图片ID');
      return [];
    }

    console.log(`找到${imageIds.length}个图片ID`);
    
    // 批量获取图片数据
    const imageKeys = imageIds.map(id => `${IMAGE_KEY_PREFIX}${id}`);
    const imagesData = await kv.mget(imageKeys);
    
    // 过滤出Telegram图片（有fileId字段的图片）
    const telegramImages = [];
    for (const imgData of imagesData) {
      if (imgData) {
        const image = typeof imgData === 'string' ? JSON.parse(imgData) : imgData;
        if (image.fileId) {
          telegramImages.push({
            id: image.id,
            fileId: image.fileId,
            category: image.category || 'general'
          });
        }
      }
    }
    
    console.log(`找到${telegramImages.length}张Telegram图片`);
    return telegramImages;
  } catch (error) {
    console.error('Error getting all telegram images:', error);
    return [];
  }
}

// 删除不在提供列表中的Telegram图片
async function deleteTelegramImagesNotInList(currentFileIds) {
  try {
    console.log('开始删除不在当前Telegram列表中的图片...');
    console.log(`当前Telegram图片fileId列表: [${currentFileIds.join(', ')}]`);
    
    const telegramImages = await getAllTelegramImages();
    const currentFileIdSet = new Set(currentFileIds);
    
    console.log(`数据库中有 ${telegramImages.length} 张Telegram图片`);
    console.log(`当前Telegram中有 ${currentFileIds.length} 张图片`);
    
    let deletedCount = 0;
    
    for (const img of telegramImages) {
      if (!currentFileIdSet.has(img.fileId)) {
        console.log(`删除已不存在的Telegram图片: ID=${img.id}, FileId=${img.fileId}, Category=${img.category}`);
        await deleteImage(img.id);
        deletedCount++;
      } else {
        console.log(`保留Telegram图片: ID=${img.id}, FileId=${img.fileId}, Category=${img.category}`);
      }
    }
    
    console.log(`删除了${deletedCount}张已不存在的Telegram图片`);
    return deletedCount;
  } catch (error) {
    console.error('Error deleting telegram images not in list:', error);
    return 0;
  }
}

module.exports = {
  getImages,
  getImage,
  getImageByFileId,
  addImage,
  updateImage,
  deleteImage,
  getCategories,
  getStats,
  getAllTelegramImages,
  deleteTelegramImagesNotInList
};