// routes/announcementRoutes.js
const express = require('express');
const router = express.Router();

const playerAnnouncementController = require('../controllers/playerAnnouncementsController');

router.get('/', playerAnnouncementController.getAllAnnouncements);

module.exports = router;
