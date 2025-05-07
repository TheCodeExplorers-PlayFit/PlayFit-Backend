const express = require('express');
const router = express.Router();
const complaintsController = require('../controllers/complaintsController');

router.get('/stadiums', complaintsController.getStadiums);
router.get('/coaches', complaintsController.getCoaches);
router.post('/submit', complaintsController.submitComplaint);

module.exports = router;