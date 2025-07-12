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

exports.updateAchievement = async (req, res) => {
  try {
    const { id } = req.params;
    const { points, status, dateEarned } = req.body;
    const success = await AchievementModel.updateAchievement(id, { points, status, dateEarned });
    if (success) {
      res.status(200).json({ message: 'Achievement updated successfully' });
    } else {
      res.status(404).json({ message: 'Achievement not found' });
    }
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.deleteAchievement = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await AchievementModel.deleteAchievement(id);
    if (success) {
      res.status(200).json({ message: 'Achievement deleted successfully' });
    } else {
      res.status(404).json({ message: 'Achievement not found' });
    }
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({ message: error.message });
  }
};