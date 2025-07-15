// File: controllers/healthTip.controller.js
const HealthTip = require('../models/HealthTip');
const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

// Helper: Upload image to Cloudinary
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'sports-app/health-tips' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null);
    bufferStream.pipe(uploadStream);
  });
};

// Create Health Tip (handles both with and without image)
exports.createHealthTip = async (req, res) => {
  try {
    const { title, category, content, image_url } = req.body;

    if (!title || !category || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title, category, and content are required',
      });
    }

    let finalImageUrl = null;

    // Handle image from file upload (multipart/form-data)
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      finalImageUrl = result.secure_url;
    }
    // Handle image URL from JSON (when uploaded via frontend to Cloudinary)
    else if (image_url) {
      finalImageUrl = image_url;
    }

    const tip = await HealthTip.create({
      title,
      category,
      content,
      image_url: finalImageUrl,
    });

    res.status(201).json({ success: true, data: tip });
  } catch (err) {
    console.error('Create health tip failed:', err);
    res.status(500).json({ success: false, message: 'Failed to create health tip' });
  }
};

// Get All Health Tips
exports.getAllHealthTips = async (req, res) => {
  try {
    const tips = await HealthTip.findAll({ order: [['createdAt', 'DESC']] });
    res.status(200).json({ success: true, data: tips });
  } catch (err) {
    console.error('Get health tips failed:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch health tips' });
  }
};

// Get Single Health Tip by ID
exports.getHealthTipById = async (req, res) => {
  try {
    const tip = await HealthTip.findByPk(req.params.id);
    if (!tip) {
      return res.status(404).json({ success: false, message: 'Health tip not found' });
    }
    res.status(200).json({ success: true, data: tip });
  } catch (err) {
    console.error('Get health tip failed:', err);
    res.status(500).json({ success: false, message: 'Failed to get health tip' });
  }
};

// Update Health Tip
exports.updateHealthTip = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, content, image_url } = req.body;

    const tip = await HealthTip.findByPk(id);
    if (!tip) {
      return res.status(404).json({ success: false, message: 'Health tip not found' });
    }

    let finalImageUrl = tip.image_url; // Keep existing image by default

    // Handle new image upload
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      finalImageUrl = result.secure_url;
    }
    // Handle new image URL
    else if (image_url) {
      finalImageUrl = image_url;
    }

    await tip.update({
      title: title || tip.title,
      category: category || tip.category,
      content: content || tip.content,
      image_url: finalImageUrl,
    });

    res.status(200).json({ success: true, data: tip });
  } catch (err) {
    console.error('Update health tip failed:', err);
    res.status(500).json({ success: false, message: 'Failed to update health tip' });
  }
};

// Delete Health Tip
exports.deleteHealthTip = async (req, res) => {
  try {
    const { id } = req.params;
    const tip = await HealthTip.findByPk(id);
    
    if (!tip) {
      return res.status(404).json({ success: false, message: 'Health tip not found' });
    }

    await tip.destroy();
    res.status(200).json({ success: true, message: 'Health tip deleted successfully' });
  } catch (err) {
    console.error('Delete health tip failed:', err);
    res.status(500).json({ success: false, message: 'Failed to delete health tip' });
  }
};

// Get Health Tips by Category
exports.getHealthTipsByCategory = async (req, res) => {
  try {
    const { category } = req.query;
    const whereClause = category ? { category } : {};
    
    const tips = await HealthTip.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });
    
    res.status(200).json({ success: true, data: tips });
  } catch (err) {
    console.error('Get health tips by category failed:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch health tips' });
  }
};

// Search Health Tips
exports.searchHealthTips = async (req, res) => {
  try {
    const { q } = req.query;
    const { Op } = require('sequelize');
    
    const tips = await HealthTip.findAll({
      where: {
        [Op.or]: [
          { title: { [Op.iLike]: `%${q}%` } },
          { content: { [Op.iLike]: `%${q}%` } }
        ]
      },
      order: [['createdAt', 'DESC']]
    });
    
    res.status(200).json({ success: true, data: tips });
  } catch (err) {
    console.error('Search health tips failed:', err);
    res.status(500).json({ success: false, message: 'Failed to search health tips' });
  }
};