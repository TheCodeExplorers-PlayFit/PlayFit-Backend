// playerAppointmentsRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const playerAppointmentsController = require('../controllers/playerAppointmentsController');

// Protect all routes and restrict to 'player' role
router.use(protect, restrictTo('player'));

// Route to search health officers by name
router.get('/health-officers', playerAppointmentsController.searchHealthOfficers);

// Route to create a new appointment
router.post('/appointments', playerAppointmentsController.createAppointment);

// Route to get player's appointment history
router.get('/appointments', playerAppointmentsController.getPlayerAppointments);

module.exports = router;