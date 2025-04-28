const express = require('express');
const router = express.Router();
const approvalsController = require('../controllers/approvalsController');

router.get('/unverified', approvalsController.getUnverifiedUsers);
router.put('/approve/:userId', approvalsController.approveUser);
router.delete('/reject/:userId', approvalsController.rejectUser);

module.exports = router;