const express = require('express');
const router = express.Router();
const CoachSessionController = require('../controllers/CoachSessionController');
const { protect } = require('../middleware/auth');
const multer = require('multer');

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Make sure this folder exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Existing routes
router.get('/weekly-timetable', CoachSessionController.getWeeklyTimetable);
router.put('/update-cost/:sessionId', CoachSessionController.updateCoachCost);
router.post('/book/:sessionId', CoachSessionController.bookSession);
router.get('/bookings/:coachId', protect, CoachSessionController.getBookingHistory);
router.get('/bookings', protect, CoachSessionController.getBookingHistory);
router.get('/salaries', protect, CoachSessionController.getCoachSalaries);
router.post('/submit-complaint', protect, CoachSessionController.submitCoachComplaint);
router.get('/stadiums', protect, CoachSessionController.getStadiums);
router.get('/details/:coachId', CoachSessionController.getSessionDetails);
router.get('/weekly-salary-overview', protect, CoachSessionController.getWeeklySalaryOverview);
router.get('/sessions-overview', protect, CoachSessionController.getSessionsOverview);
router.get('/notices', CoachSessionController. getAllNotices);
router.get('/notices/coaches', CoachSessionController.getCoachNotices);
router.get('/recent', CoachSessionController.getRecentStadiumRatings);
router.get('/search', CoachSessionController.searchStadiums);
router.post('/rate', protect, CoachSessionController.addStadiumRating);

//  new route for blog submission with image upload
router.post('/blogs', protect, upload.single('image'), CoachSessionController.submitCoachBlog);

module.exports = router;
