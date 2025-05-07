const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');

<<<<<<< HEAD
// Get all locations
router.get('/locations', sessionController.getLocations);

// Get stadiums by location and sport
router.get('/stadiums', sessionController.getStadiumsByLocationAndSport);

// Get stadiums by location only
router.get('/stadiums-by-location', sessionController.getStadiumsByLocation);

// Get weekly timetable for a stadium
router.get('/timetable', sessionController.getWeeklyTimetable);

// Validate session availability and cost
router.get('/validate-session', sessionController.validateSession);

// Initiate PayHere payment
router.post('/initiate-payment', sessionController.initiatePayment);

// Handle PayHere webhook
router.post('/payment-webhook', sessionController.handlePaymentWebhook);

// Set sport cost for a stadium-sport combination (Stadium Owner)
router.post('/set-sport-cost', sessionController.setSportCost);

// Create a session (Coach)
=======
router.get('/locations', sessionController.getLocations);
router.get('/stadiums', sessionController.getStadiumsByLocationAndSport);
router.get('/stadiums-by-location', sessionController.getStadiumsByLocation);
router.get('/timetable', sessionController.getWeeklyTimetable);
router.get('/validate-session', sessionController.validateSession);
router.get('/booking-details', sessionController.getBookingDetails);
router.post('/initiate-payment', sessionController.initiatePayment);
router.post('/payment-webhook', sessionController.handlePaymentWebhook);
router.post('/complete-payment', sessionController.completePayment);
router.post('/set-sport-cost', sessionController.setSportCost);
>>>>>>> dev
router.post('/create-session', sessionController.createSession);

module.exports = router;