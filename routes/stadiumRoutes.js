const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const stadiumController = require('../controllers/stadiumController');

router.post('/add', protect, stadiumController.addStadium);

module.exports = router;
