const kv = require('@vercel/kv');

// 初始化KV数据库
async function initializeKV() {
    try {
        // 检查是否已经初始化
        const initialized = await kv.get('imgbed:initialized');
        
        if (!initialized) {
            // 初始化分类集合
            await kv.set('imgbed:categories', JSON.stringify(['uncategorized']));
            
            // 初始化统计信息
            await kv.set('imgbed:stats', JSON.stringify({
                totalImages: 0,
                totalSize: 0,
                lastUpdated: new Date().toISOString()
            }));
            
            // 设置初始化标记
            await kv.set('imgbed:initialized', 'true');
        }
    } catch (error) {
        console.error('Failed to initialize KV database:', error);
    }
}

// 获取图片列表
async function getImages(page = 1, limit = 20, category = '') {
    try {
        // 确保KV已初始化
        await initializeKV();
        
        // 获取所有图片
        let images = [];
        const imageKeys = await kv.keys('imgbed:image:*');
        
        if (imageKeys && imageKeys.length > 0) {
            const imageValues = await kv.mget(imageKeys);
            images = imageValues.filter(Boolean).map(JSON.parse);
        }
        
        // 按分类过滤
        if (category && category !== 'all') {
            images = images.filter(img => img.category === category);
        }
        
        // 按上传时间降序排序
        images.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        
        // 计算总数
        const total = images.length;
        
        // 分页
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedImages = images.slice(startIndex, endIndex);
        
        return {
            images: paginatedImages,
            total
        };
    } catch (error) {
        console.error('Error getting images:', error);
        return {
            images: [],
            total: 0
        };
    }
}

// 获取单个图片
async function getImage(id) {
    try {
        const image = await kv.get(`imgbed:image:${id}`);
        return image ? JSON.parse(image) : null;
    } catch (error) {
        console.error('Error getting image:', error);
        return null;
    }
}

// 添加图片
async function addImage(imageData) {
    try {
        // 确保KV已初始化
        await initializeKV();
        
        // 生成唯一ID
        const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 创建图片对象
        const image = {
            id,
            ...imageData,
            uploadDate: new Date().toISOString()
        };
        
        // 保存图片
        await kv.set(`imgbed:image:${id}`, JSON.stringify(image));
        
        // 更新统计信息
        await updateStats(1, imageData.size || 0);
        
        return image;
    } catch (error) {
        console.error('Error adding image:', error);
        return null;
    }
}

// 更新图片
async function updateImage(id, updateData) {
    try {
        // 获取现有图片
        const existingImage = await getImage(id);
        if (!existingImage) {
            return null;
        }
        
        // 更新图片数据
        const updatedImage = {
            ...existingImage,
            ...updateData,
            id, // 确保ID不被更改
            uploadDate: existingImage.uploadDate // 保持原始上传日期
        };
        
        // 保存更新后的图片
        await kv.set(`imgbed:image:${id}`, JSON.stringify(updatedImage));
        
        return updatedImage;
    } catch (error) {
        console.error('Error updating image:', error);
        return null;
    }
}

// 删除图片
async function deleteImage(id) {
    try {
        // 获取图片信息
        const image = await getImage(id);
        if (!image) {
            return null;
        }
        
        // 删除图片
        await kv.del(`imgbed:image:${id}`);
        
        // 更新统计信息
        await updateStats(-1, -(image.size || 0));
        
        return image;
    } catch (error) {
        console.error('Error deleting image:', error);
        return null;
    }
}

// 获取分类列表
async function getCategories() {
    try {
        // 确保KV已初始化
        await initializeKV();
        
        // 获取分类列表
        const categories = await kv.get('imgbed:categories');
        return categories ? JSON.parse(categories) : ['uncategorized'];
    } catch (error) {
        console.error('Error getting categories:', error);
        return ['uncategorized'];
    }
}

// 添加分类
async function addCategory(category) {
    try {
        // 获取现有分类
        const categories = await getCategories();
        
        // 检查分类是否已存在
        if (categories.includes(category)) {
            return false;
        }
        
        // 添加新分类
        categories.push(category);
        await kv.set('imgbed:categories', JSON.stringify(categories));
        
        return true;
    } catch (error) {
        console.error('Error adding category:', error);
        return false;
    }
}

// 获取统计信息
async function getStats() {
    try {
        // 确保KV已初始化
        await initializeKV();
        
        // 获取统计信息
        const stats = await kv.get('imgbed:stats');
        return stats ? JSON.parse(stats) : {
            totalImages: 0,
            totalSize: 0,
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error getting stats:', error);
        return {
            totalImages: 0,
            totalSize: 0,
            lastUpdated: new Date().toISOString()
        };
    }
}

// 更新统计信息
async function updateStats(imageCountDelta, sizeDelta) {
    try {
        // 获取当前统计信息
        const stats = await getStats();
        
        // 更新统计信息
        const updatedStats = {
            totalImages: Math.max(0, stats.totalImages + imageCountDelta),
            totalSize: Math.max(0, stats.totalSize + sizeDelta),
            lastUpdated: new Date().toISOString()
        };
        
        // 保存更新后的统计信息
        await kv.set('imgbed:stats', JSON.stringify(updatedStats));
        
        return updatedStats;
    } catch (error) {
        console.error('Error updating stats:', error);
        return null;
    }
}

module.exports = {
    getImages,
    getImage,
    addImage,
    updateImage,
    deleteImage,
    getCategories,
    addCategory,
    getStats
};