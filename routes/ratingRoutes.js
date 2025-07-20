// routes/ratingRoutes.js
const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');

// Get all ratings with pagination and search
router.get('/', ratingController.getAllRatings);

// Get rating statistics
router.get('/statistics', ratingController.getRatingStatistics);

// Get ratings for specific entity
router.get('/:entityType/:entityId', ratingController.getEntityRatings);

// Delete a rating
router.delete('/:id', ratingController.deleteRating);

module.exports = router;