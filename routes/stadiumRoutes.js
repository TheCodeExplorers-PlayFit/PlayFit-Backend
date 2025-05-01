// routes/stadiumRoutes.js
const express = require('express');
const { getStadiumsByCoachSports } = require('../controllers/stadiumController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Route to get stadiums based on coach's sports
router.get('/by-coach-sports', protect, getStadiumsByCoachSports);

module.exports = router;