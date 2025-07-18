const express = require('express');
const router = express.Router();

const { postQuestion, getQuestionsByTip, answerQuestion } = require('../controllers/questionController');

// POST a question
router.post('/', postQuestion);

// GET all questions for a health tip
router.get('/:tipId', getQuestionsByTip);

// POST an answer
router.post('/:questionId/answer', answerQuestion);

module.exports = router;
