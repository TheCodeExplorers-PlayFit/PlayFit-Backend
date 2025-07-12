const AchievementModel = require('../models/achievementModel');

exports.getAchievements = async (req, res) => {
  try {
    const achievement = await AchievementModel.getAchievements();
    res.status(200).json(achievement);
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getAchievementDetails = async (req, res) => {
  try {
    const details = await AchievementModel.getAchievementDetails();
    res.status(200).json(details);
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getTop3Achievers = async (req, res) => {
  try {
    const topAchievers = await AchievementModel.getTop3Achievers();
    res.status(200).json(topAchievers);
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({ message: error.message });
  }
};