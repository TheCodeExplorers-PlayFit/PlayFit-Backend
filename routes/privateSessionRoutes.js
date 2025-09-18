const express = require('express');
const router = express.Router();
const privateSessionsController = require('../controllers/privateSessionsController');
const { protect, restrictTo } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Coach routes
router.post('/create', restrictTo('coach'), privateSessionsController.createPrivateSession);
router.get('/coach', restrictTo('coach'), privateSessionsController.getCoachPrivateSessions);
router.post('/accept', restrictTo('coach'), privateSessionsController.acceptPrivateSession);
router.post('/reject', restrictTo('coach'), privateSessionsController.rejectPrivateSession);
router.get('/sports', restrictTo('coach'), privateSessionsController.getCoachSports);

// Player routes
router.get('/available', restrictTo('player'), privateSessionsController.getAvailablePrivateSessions);
router.post('/request', restrictTo('player'), privateSessionsController.requestPrivateSession);

// General routes
router.get('/stadiums/search', restrictTo('coach'), privateSessionsController.searchStadiums);

module.exports = router;