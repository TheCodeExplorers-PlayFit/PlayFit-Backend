// routes/reportsRoutes.js

const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');

// Monthly Reports Routes
router.get('/financial', reportsController.getMonthlyFinancialReport);
router.get('/financial-range', reportsController.getFinancialReportRange);

router.get('/health', reportsController.getMonthlyHealthReport);
router.get('/health-range', reportsController.getHealthReportRange);

router.get('/operations', reportsController.getMonthlyOperationsReport);
router.get('/operations-range', reportsController.getOperationsReportRange);

router.get('/content', reportsController.getMonthlyContentReport);
router.get('/content-range', reportsController.getContentReportRange);

// Utility Routes
router.get('/available-months', reportsController.getAvailableMonths);

// Export Routes
router.get('/export/financial', reportsController.exportFinancialReport);
router.get('/export/health', reportsController.exportHealthReport);
router.get('/export/operations', reportsController.exportOperationsReport);
router.get('/export/content', reportsController.exportContentReport);

// Comprehensive Report
router.get('/comprehensive', reportsController.generateComprehensiveReport);

module.exports = router;