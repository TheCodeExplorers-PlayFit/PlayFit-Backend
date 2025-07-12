const express = require('express');
const router = express.Router();
const achievementController = require('../controllers/achievementController');

router.get('/achievements', achievementController.getAchievements);
router.get('/achievement-details', achievementController.getAchievementDetails);
router.get('/top-achievers', achievementController.getTop3Achievers);

module.exports = router;