const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');

// Get all locations
router.get('/locations', sessionController.getLocations);

// Get stadiums by location and sport
router.get('/stadiums', sessionController.getStadiumsByLocationAndSport);

// Get weekly timetable for a stadium
router.get('/timetable', sessionController.getWeeklyTimetable);

module.exports = router;