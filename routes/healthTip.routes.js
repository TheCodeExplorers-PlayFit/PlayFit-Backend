// File: routes/healthTip.routes.js
const express = require('express');
const router = express.Router();
const healthTipController = require('../controllers/healthTip.controller');
const multer = require('multer');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only JPG, PNG, JPEG
    if (
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/jpg' ||
      file.mimetype === 'image/jpeg'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and JPEG files are allowed'), false);
    }
  }
});

// ➕ Create health tip
router.post('/', upload.single('image_url'), healthTipController.createHealthTip);

// 📄 Get all health tips (with optional category filter)
router.get('/', healthTipController.getHealthTipsByCategory);

// 🔍 Search health tips
router.get('/search', healthTipController.searchHealthTips);

// ✏️ Update health tip by ID (with optional new image)
router.put('/:id', upload.single('image_url'), healthTipController.updateHealthTip);

// 🗑️ Delete health tip by ID
router.delete('/:id', healthTipController.deleteHealthTip);


// 📄 Get health tips by healthOfficer_id
router.get('/by-officer/:healthOfficerId', healthTipController.getHealthTipsByOfficerId);


// 📄 Get single health tip by ID
router.get('/:id', healthTipController.getHealthTipById);


// Get health tips by category
//GET /api/health-tips/category/:category
router.get('/category/:category', healthTipController.getHealthTipsByCategory);

module.exports = router;