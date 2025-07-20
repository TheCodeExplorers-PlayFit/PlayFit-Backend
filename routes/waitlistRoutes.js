// waitlistRoutes.js - Stadium Owner Only Routes
const express = require('express');
const router = express.Router();
const waitlistController = require('../controllers/waitlistController');

// Middleware for input validation
const validateOwnerId = (req, res, next) => {
  const { ownerId } = req.query;
  
  if (!ownerId || !Number.isInteger(parseInt(ownerId)) || parseInt(ownerId) <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid owner ID is required'
    });
  }
  
  next();
};

const validateWaitlistUpdate = (req, res, next) => {
  const { waitlistId, status } = req.body;
  
  if (!waitlistId || !Number.isInteger(waitlistId) || waitlistId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid waitlist ID is required'
    });
  }
  
  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Status must be either approved or rejected'
    });
  }
  
  next();
};

// Optional: Authentication middleware (if you have one)
// const authenticateStadiumOwner = require('../middleware/auth');

// Stadium Owner Routes
router.get('/waitlist', validateOwnerId, waitlistController.getWaitlistForOwner);
router.post('/waitlist/update-status', validateWaitlistUpdate, waitlistController.updateWaitlistStatus);
router.get('/waitlist/stats', validateOwnerId, waitlistController.getWaitlistStats);
router.get('/waitlist', waitlistController.getWaitlistByOwnerId);

module.exports = router;