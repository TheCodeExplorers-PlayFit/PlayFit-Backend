const express = require('express');
const router = express.Router();
const CoachSessionController = require('../controllers/CoachSessionController');
const { protect } = require('../middleware/auth');

router.get('/weekly-timetable', CoachSessionController.getWeeklyTimetable);
router.put('/update-cost/:sessionId', CoachSessionController.updateCoachCost);
router.post('/book/:sessionId', CoachSessionController.bookSession); // Fixed route
router.get('/bookings/:coachId', protect, CoachSessionController.getBookingHistory); // New route for coach-specific history
router.get('/bookings', protect, CoachSessionController.getBookingHistory);
router.get('/salaries', protect, CoachSessionController.getCoachSalaries);

module.exports = router;