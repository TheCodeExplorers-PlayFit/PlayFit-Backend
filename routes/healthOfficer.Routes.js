const express = require('express');
const router = express.Router();
const healthOfficerController = require('../controllers/healthOfficer.Controller');

// POST /api/healthofficers
router.post('/', healthOfficerController.createHealthOfficer);

module.exports = router;
