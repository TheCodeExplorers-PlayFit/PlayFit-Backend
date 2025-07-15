const express = require('express');
const router = express.Router();
const achievementController = require('../controllers/achievementController');

router.get('/achievements', achievementController.getAchievements);
router.get('/achievement-details', achievementController.getAchievementDetails);
router.get('/top-achievers-by-stadium', achievementController.getTopAchieversByStadium);
router.put('/achievement/:id', achievementController.updateAchievement);
router.delete('/achievement/:id', achievementController.deleteAchievement);

module.exports = router;