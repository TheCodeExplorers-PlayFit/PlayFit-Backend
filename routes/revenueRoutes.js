const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const RevenueController = require('../controllers/revenueController');

router.use(protect);
router.use(restrictTo('stadiumOwner'));

router.get('/data', RevenueController.getRevenueData);

module.exports = router;