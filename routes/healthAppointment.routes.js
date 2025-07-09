const express = require('express');
const router = express.Router();
const healthAppointmentController = require('../controllers/healthAppointment.controller');

// GET /api/appointments/:healthOfficerId
router.get('/:healthOfficerId', healthAppointmentController.getAppointmentsByOfficerId);

// POST /api/appointments/update-status
router.post('/update-status', healthAppointmentController.updateAppointmentStatus);

module.exports = router;
