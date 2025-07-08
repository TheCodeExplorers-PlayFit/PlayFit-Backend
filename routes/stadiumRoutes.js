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

router.post('/add', protect, restrictTo('stadiumOwner'), addStadium);
router.get('/', protect, restrictTo('stadiumOwner'), getStadiums);
router.get('/by-coach-sports', protect, restrictTo('coach'), getStadiumsByCoachSports);
router.put('/:id', protect, restrictTo('stadiumOwner'), updateStadium);
router.delete('/:id', protect, restrictTo('stadiumOwner'), deleteStadium);
router.get('/cloudinary-signature', protect, restrictTo('stadiumOwner'), (req, res) => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = // Generate signature using your API Secret 
  res.json({ timestamp, signature });
});

module.exports = router;