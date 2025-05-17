const express = require('express');
const router = express.Router();
const CoachSessionController = require('../controllers/CoachSessionController');
const { protect } = require('../middleware/auth'); // Import the protect middleware

// Routes
router.get('/weekly-timetable', CoachSessionController.getWeeklyTimetable);
router.put('/update-cost/:sessionId', CoachSessionController.updateCoachCost);
router.put('/book-session/:sessionId', CoachSessionController.bookSession);
router.get('/bookings', protect, CoachSessionController.getBookingHistory); // Apply protect middleware
router.get('/details', protect, CoachSessionController.getCoachDetails); // Apply protect middleware (assuming this route is intended)

module.exports = router;