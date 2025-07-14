const express = require('express');
const router = express.Router();
const healthTipController = require('../controllers/healthTip.controller');
const multer = require('multer');

// Memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload with image
router.post('/upload', upload.single('image'), healthTipController.createWithImage);


// Regular tip post
router.post('/', healthTipController.createHealthTip);

// Get tips
router.get('/', healthTipController.getAllHealthTips);

module.exports = router;
