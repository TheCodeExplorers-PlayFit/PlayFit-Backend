const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
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
router.post('/create-session', sessionController.createSession);

module.exports = router;