const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

// Get completed transactions for a player
router.get('/player/:playerId', transactionController.getPlayerTransactions);

module.exports = router;