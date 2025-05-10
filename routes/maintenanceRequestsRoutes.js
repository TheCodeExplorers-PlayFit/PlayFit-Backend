const express = require('express');
const router = express.Router();
const maintenanceRequestsController = require('../controllers/maintenanceRequestsController');

router.get('/maintenance-requests', maintenanceRequestsController.getMaintenanceRequests);
router.put('/maintenance-requests', maintenanceRequestsController.updateMaintenanceRequest);

module.exports = router;