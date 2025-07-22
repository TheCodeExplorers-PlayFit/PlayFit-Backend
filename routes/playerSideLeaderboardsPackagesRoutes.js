const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const {
  getLeaderboards,
  getPackages,
  initiatePackagePayment,
  handlePackagePaymentWebhook,
  confirmPackageAssignment
} = require('../controllers/playerSideLeaderboardsPackagesController');

// Protect all routes and restrict to player role
router.use(protect, restrictTo('player'));

router.get('/leaderboards', getLeaderboards);
router.get('/packages', getPackages);
router.post('/initiate-package-payment', initiatePackagePayment);
router.post('/confirm-package-assignment', confirmPackageAssignment);

// Webhook route (no auth required as it's called by PayHere)
router.post('/package-payment-webhook', handlePackagePaymentWebhook);

module.exports = router;