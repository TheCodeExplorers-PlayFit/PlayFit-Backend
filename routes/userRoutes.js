// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Register user
router.post('/register', userController.registerUser);

// Login user
router.post('/login', userController.loginUser);

//get sports
router.get('/sports', userController.getSports);

module.exports = router;