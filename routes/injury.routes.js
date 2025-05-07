const express = require('express');
const router = express.Router();
const injuryController = require('../controllers/injury.controller');

router.post('/', injuryController.createInjury);

module.exports = router;
