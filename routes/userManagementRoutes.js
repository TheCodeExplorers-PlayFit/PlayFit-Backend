const express = require('express');
const router = express.Router();
const { getAllUsers, deleteUser } = require('../controllers/userManagementController');
const { protect, restrictTo } = require('../middleware/authenticationMiddleware');

router.use(protect); // Protect all routes
router.use(restrictTo('admin')); // Restrict to admin role

router.get('/', getAllUsers);
router.delete('/:id', deleteUser);

module.exports = router;