const express = require('express');
const router = express.Router();
const CoachSessionController = require('../controllers/CoachSessionController');
const { protect } = require('../middleware/auth');

router.get('/weekly-timetable', CoachSessionController.getWeeklyTimetable);
router.put('/update-cost/:sessionId', CoachSessionController.updateCoachCost);
router.put('/book-session/:sessionId', CoachSessionController.bookSession);
router.get('/bookings', protect, CoachSessionController.getBookingHistory);
router.get('/salaries', protect, CoachSessionController.getCoachSalaries); // Protected route

module.exports = router;