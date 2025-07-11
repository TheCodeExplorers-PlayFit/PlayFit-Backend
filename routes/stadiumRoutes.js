const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const {
  addStadium,
  getStadiumsByCoachSports,
  getStadiums,
  updateStadium,
  deleteStadium
} = require('../controllers/stadiumController');

router.get('/by-coach-sports', protect, restrictTo('coach'), getStadiumsByCoachSports);
router.get('/cloudinary-signature', protect, restrictTo('stadiumOwner'), (req, res) => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = // Generate signature using your API Secret 
  res.json({ timestamp, signature });
});

module.exports = router;