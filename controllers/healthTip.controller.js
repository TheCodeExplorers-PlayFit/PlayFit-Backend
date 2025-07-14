const { HealthTip } = require('../models');
const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'sports-app/health-tips' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null);
    bufferStream.pipe(uploadStream);
  });
};

// With Image Upload
exports.createHealthTip = async (req, res) => {
  try {
    const { title, category, content } = req.body;

    if (!title || !category || !content) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file.buffer);
    }

    const tip = await HealthTip.create({
      title,
      category,
      content,
      image_url: imageUrl
    });

    res.status(201).json({ success: true, data: tip });
  } catch (error) {
    console.error('❌ Error creating health tip:', error);
    res.status(500).json({ success: false, message: 'Failed to create health tip' });
  }
};

exports.createHealthTip = async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required' });
    }

    const newTip = await HealthTip.create({ title, content });

    res.status(201).json({ success: true, data: newTip });
  } catch (error) {
    console.error('Error creating health tip:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.getAllHealthTips = async (req, res) => {
  try {
    const tips = await HealthTip.findAll({ order: [['created_at', 'DESC']] });
    res.json({ success: true, data: tips });
  } catch (error) {
    console.error('Error fetching health tips:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tips' });
  }
};

exports.createHealthTip = async (req, res) => {
  try {
    const tip = await HealthTip.create(req.body);
    res.status(201).json({ success: true, data: tip });
  } catch (error) {
    console.error("❌ Error creating health tip:", error.message, error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
