const express = require('express');
const router = express.Router();
const ratingsController = require('../controllers/ratingsController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect); // Protect all routes with JWT authentication

router.get('/stadiums/search', restrictTo('player'), ratingsController.searchStadiums);
router.get('/coaches/search', restrictTo('player'), ratingsController.searchCoaches);
router.get('/:entityType/:entityId', restrictTo('player'), ratingsController.getRatings);
router.post('/', restrictTo('player'), ratingsController.createRating);

module.exports = router;