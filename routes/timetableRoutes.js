const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetableController');

// Get future booked sessions for a player
router.get('/player/:playerId', timetableController.getPlayerTimetable);

module.exports = router;