const express = require('express');
const router = express.Router();
const healthAppointmentController = require('../controllers/healthAppointment.controller');

// GET /api/appointments/:healthOfficerId
router.get('/:healthOfficerId', healthAppointmentController.getAppointmentsByOfficerId);

module.exports = router;
