const express = require('express');
const router = express.Router();
const CoachSessionController = require('../controllers/CoachSessionController');

// Define routes
router.get('/timetable', CoachSessionController.getWeeklyTimetable); // GET /api/coach-sessions/timetable?stadiumId=<id>&startDate=<date>
router.put('/update-cost/:sessionId', CoachSessionController.updateCoachCost); // PUT /api/coach-sessions/update-cost/:sessionId
router.post('/book/:sessionId', CoachSessionController.bookSession); // POST /api/coach-sessions/book/:sessionId

module.exports = router;