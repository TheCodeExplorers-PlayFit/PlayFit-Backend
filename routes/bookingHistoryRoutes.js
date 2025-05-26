const express = require('express');
const router = express.Router();
const bookingHistoryController = require('../controllers/bookingHistoryController');

// Get all bookings for a player
router.get('/player/:playerId', bookingHistoryController.getPlayerBookings);

module.exports = router;