const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Register user
router.post('/register', userController.registerUser);

// Login user
router.post('/login', userController.loginUser);

// Verify email
router.post('/verify-email', userController.verifyEmail);

// Forgot password
router.post('/forgot-password', userController.forgotPassword);

// Verify reset code
router.post('/verify-reset-code', userController.verifyResetCode);

// Reset password
router.post('/reset-password', userController.resetPassword);

// Get sports
router.get('/sports', userController.getSports);

module.exports = router;