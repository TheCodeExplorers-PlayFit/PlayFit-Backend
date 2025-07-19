// backend/routes/calendarRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const { getStadiums, getSessionsByStadiumAndDate } = require('../controllers/calendarController');

// Protect all routes and restrict to admin
router.use(protect, restrictTo('admin'));

router.get('/stadiums', getStadiums);
router.get('/sessions/:stadiumId/:date', getSessionsByStadiumAndDate);

module.exports = router;