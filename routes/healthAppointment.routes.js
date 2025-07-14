const express = require('express');
const router = express.Router();
const healthAppointmentController = require('../controllers/healthAppointment.controller');

// GET /api/appointments/:healthOfficerId
router.get('/:healthOfficerId', healthAppointmentController.getAppointmentsByOfficerId);

// POST /api/appointments/update-status
router.post('/update-status', healthAppointmentController.updateAppointmentStatus);

//get,filter approved appointments
router.get('/:healthOfficerId/approved', healthAppointmentController.getApprovedAppointments);
 
// GET /api/appointments/details/:appointmentId - Get single appointment with user details
router.get('/details/:appointmentId', healthAppointmentController.getAppointmentById);

// GET /api/appointments/:healthOfficerId/with-user-details - Get all appointments with user details
router.get('/:healthOfficerId/with-user-details', healthAppointmentController.getAppointmentsWithUserDetails);

// GET /api/appointments/:healthOfficerId/approved-with-details - Get approved appointments with user details
router.get('/:healthOfficerId/approved-with-details', healthAppointmentController.getApprovedAppointmentsWithUserDetails);


module.exports = router;
