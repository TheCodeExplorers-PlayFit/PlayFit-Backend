
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const StadiumOwnerAnnouncementController = require('../controllers/stadiumOwnerAnnouncementController');

router.use(protect);
router.use(restrictTo('stadiumOwner'));

router.get('/', StadiumOwnerAnnouncementController.getAnnouncements);

module.exports = router;
