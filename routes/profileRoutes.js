const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getProfile,
  updateProfile,
  updateProfilePicture,
  searchUsers,
} = require('../controllers/profileController');

router.get('/me', protect, getProfile);
router.put('/update', protect, updateProfile);
router.put('/update-picture', protect, updateProfilePicture);
router.get('/search', protect, searchUsers);

module.exports = router;