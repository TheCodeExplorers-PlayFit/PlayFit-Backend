const AchievementsModel = require('../models/achievementsModel');

exports.getAchievements = async (req, res) => {
  try {
    const achievements = await AchievementsModel.getAchievements();
    res.json(achievements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};