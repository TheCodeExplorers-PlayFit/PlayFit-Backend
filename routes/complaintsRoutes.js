const express = require('express');
const router = express.Router();
const complaintsController = require('../controllers/complaintsController');

router.get('/stadiums', complaintsController.getStadiums);
router.get('/coaches', complaintsController.getCoaches);
router.post('/submit', complaintsController.submitComplaint);
router.get('/my-complaints/:playerId', complaintsController.getMyComplaints);


module.exports = router;