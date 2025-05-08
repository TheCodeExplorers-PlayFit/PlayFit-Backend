// routes/coachSessionRoutes.js
const express = require('express');
const router = express.Router();
const CoachSessionController = require('../controllers/CoachSessionController');

// Define route
router.get('/timetable', CoachSessionController.getWeeklyTimetable); // GET /api/coach-sessions/timetable?stadiumId=<id>&startDate=<date>

module.exports = router;