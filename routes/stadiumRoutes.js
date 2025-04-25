const express = require('express');
const router = express.Router();
const stadiumController = require('../controllers/stadiumController');

router.get('/', stadiumController.getStadiums);

module.exports = router;