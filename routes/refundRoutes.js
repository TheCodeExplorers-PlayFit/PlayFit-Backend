// refundRoutes.js
const express = require('express');
const router = express.Router();
const refundController = require('../controllers/refundController');

// Request a refund by cancelling a booking
router.post('/request-refunded', refundController.requestRefund);

module.exports = router;