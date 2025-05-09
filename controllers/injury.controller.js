/// File: controllers/injury.controller.js
const Injury = require('../models/injury.model');
const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

exports.createInjury = async (req, res) => {
  try {
    const injury = await Injury.create(req.body);
    res.status(201).json({ success: true, data: injury });
  } catch (err) {
    console.error('Create injury failed:', err);
    res.status(500).json({ success: false, message: 'Failed to create injury' });
  }
};

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'sports-app/injury-files' },
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

exports.createInjuryWithFiles = async (req, res) => {
  try {
    const injuryData = { ...req.body };
    const fileUrls = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.buffer);
          fileUrls.push(result.secure_url);
        } catch (uploadError) {
          console.error('File upload failed:', uploadError);
        }
      }
    }

    injuryData.medical_files = fileUrls.join(',');

    const injury = await Injury.create(injuryData);

    res.status(201).json({
      success: true,
      data: injury,
      files: fileUrls
    });
  } catch (err) {
    console.error('Create injury with files failed:', err);
    res.status(500).json({ success: false, message: 'Failed to create injury with files' });
  }
};

exports.getInjuries = async (req, res) => {
  try {
    const injuries = await Injury.findAll();
    res.status(200).json({ success: true, data: injuries });
  } catch (err) {
    console.error('Get injuries failed:', err);
    res.status(500).json({ success: false, message: 'Failed to get injuries' });
  }
};

exports.getInjuryById = async (req, res) => {
  try {
    const injury = await Injury.findByPk(req.params.id);
    if (!injury) {
      return res.status(404).json({ success: false, message: 'Injury not found' });
    }
    res.status(200).json({ success: true, data: injury });
  } catch (err) {
    console.error('Get injury failed:', err);
    res.status(500).json({ success: false, message: 'Failed to get injury' });
  }
};
