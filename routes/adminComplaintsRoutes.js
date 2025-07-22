const express = require('express');
const router = express.Router();
const adminComplaintsController = require('../controllers/adminComplaintsController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect);
router.use(restrictTo('admin'));

router.get('/complaints', adminComplaintsController.getAllComplaints);
router.patch('/complaints/:id/resolve', adminComplaintsController.resolveComplaint);

module.exports = router;