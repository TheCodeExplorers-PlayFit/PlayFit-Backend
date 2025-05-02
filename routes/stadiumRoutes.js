const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const stadiumController = require('../controllers/stadiumController');

// Route to add a stadium (e.g., for stadium owners)
router.post('/add', protect, stadiumController.addStadium);

// Route to get stadiums based on coach's sports
router.get('/by-coach-sports', protect, stadiumController.getStadiumsByCoachSports);

module.exports = router;

