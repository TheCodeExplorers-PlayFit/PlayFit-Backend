// routes/waitlistRoutes.js
const express = require('express');
const router = express.Router();
const waitlistController = require('../controllers/waitlistController');
const { protect, restrictTo } = require('../middleware/auth');

router.post('/add', protect, restrictTo('stadiumOwner'), waitlistController.addToWaitlist);
router.get('/', protect, restrictTo('stadiumOwner'), waitlistController.getWaitlist);
router.put('/status', protect, restrictTo('stadiumOwner'), waitlistController.updateWaitlistStatus);
router.get('/stats', protect, restrictTo('stadiumOwner'), waitlistController.getWaitlistStats);

module.exports = router;