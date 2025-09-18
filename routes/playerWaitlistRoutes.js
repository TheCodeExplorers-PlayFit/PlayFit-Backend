const express = require('express');
const router = express.Router();
const playerWaitlistController = require('../controllers/playerWaitlistController');

router.get('/fully-booked-sessions', playerWaitlistController.getFullyBookedSessions);
router.post('/add-to-waitlist', playerWaitlistController.addToWaitlist);

module.exports = router;