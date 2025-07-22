const Question = require('../models/Question');

// Post a new question
exports.postQuestion = async (req, res) => {
  try {
    const { health_tip_id, player_id, question } = req.body;
    const newQuestion = await Question.create({ health_tip_id, player_id, question });
    res.status(201).json({ success: true, data: newQuestion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all questions for a health tip
exports.getQuestionsByTip = async (req, res) => {
  try {
    const { tipId } = req.params;
    const questions = await Question.findAll({ where: { health_tip_id: tipId } });
    res.status(200).json({ success: true, data: questions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Answer a question (optional for admin/health officer)
exports.answerQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { answer } = req.body;
    await Question.update({ answer }, { where: { id } });
    res.json({ success: true, message: 'Answer submitted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
