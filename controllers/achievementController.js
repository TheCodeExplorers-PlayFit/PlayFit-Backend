const AchievementModel = require('../models/achievementModel');

exports.getAchievements = async (req, res) => {
  try {
    const data = await AchievementModel.getAchievements(req);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAchievementDetails = async (req, res) => {
  try {
    const data = await AchievementModel.getAchievementDetails(req);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTopAchieversByStadium = async (req, res) => {
  try {
    const data = await AchievementModel.getTopAchieversByStadium(req);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateAchievement = async (req, res) => {
  try {
    const { id } = req.params;
    const { points, dateEarned } = req.body;
    const success = await AchievementModel.updateAchievement(id, { points, dateEarned });
    if (success) {
      res.status(200).json({ message: 'Achievement updated' });
    } else {
      res.status(404).json({ error: 'Achievement not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteAchievement = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await AchievementModel.deleteAchievement(id);
    if (success) {
      res.status(200).json({ message: 'Achievement deleted' });
    } else {
      res.status(404).json({ error: 'Achievement not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};