const express = require('express');
const router = express.Router();
const maintenanceRequestsController = require('../controllers/maintenanceRequestsController');
const { protect } = require('../middleware/auth');

router.get('/maintenance-requests',protect, maintenanceRequestsController.getMaintenanceRequests);
router.put('/maintenance-requests',protect, maintenanceRequestsController.updateMaintenanceRequest);

module.exports = router;