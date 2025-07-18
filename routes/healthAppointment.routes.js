const express = require('express');
const router = express.Router();
const healthAppointmentController = require('../controllers/healthAppointment.controller');

// DEBUG route (add this for testing)
router.get('/debug/:healthOfficerId', healthAppointmentController.debugAppointmentData);

// Weekly summary routes - try different approaches
router.get('/weekly-summary/:healthOfficerId', healthAppointmentController.getWeeklyAppointmentsSummary);
router.get('/weekly-summary-raw/:healthOfficerId', healthAppointmentController.getWeeklyAppointmentsSummaryRaw);
router.get('/weekly-summary-simple/:healthOfficerId', healthAppointmentController.getWeeklyAppointmentsSummarySimple);

// GET /api/appointments/details/:appointmentId - Get single appointment with user details
router.get('/details/:appointmentId', healthAppointmentController.getAppointmentById);

// GET /api/appointments/:healthOfficerId/with-user-details - Get all appointments with user details
router.get('/:healthOfficerId/with-user-details', healthAppointmentController.getAppointmentsWithUserDetails);

// GET /api/appointments/:healthOfficerId/approved-with-details - Get approved appointments with user details
router.get('/:healthOfficerId/approved-with-details', healthAppointmentController.getApprovedAppointmentsWithUserDetails);

// GET /api/appointments/:healthOfficerId/approved - Get approved appointments
router.get('/:healthOfficerId/approved', healthAppointmentController.getApprovedAppointments);

// GET /api/appointments/:healthOfficerId - Get all appointments
router.get('/:healthOfficerId', healthAppointmentController.getAppointmentsByOfficerId);

// POST /api/appointments/update-status
router.post('/update-status', healthAppointmentController.updateAppointmentStatus);

module.exports = router;