const express = require('express');
const router = express.Router();
const { getAllUsers, deleteUser } = require('../controllers/userManagementController');
const { protect, restrictTo } = require('../middleware/auth'); // Updated import

// Protected routes (admin only)
router.route('/')
  .get(protect, restrictTo('admin'), getAllUsers);

router.route('/:id')
  .delete(protect, restrictTo('admin'), deleteUser);

module.exports = router;