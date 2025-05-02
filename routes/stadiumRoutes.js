const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const stadiumController = require('../controllers/stadiumController');

// Route to add a stadium (restricted to stadium owners)
router.post('/add', protect, restrictTo('stadiumOwner'), stadiumController.addStadium);

// Route to get stadiums (restricted to stadium owners)
router.get('/', protect, restrictTo('stadiumOwner'), stadiumController.getStadiums);

// Route to get stadiums by coach sports (restricted to coaches)
router.get('/by-coach-sports', protect, restrictTo('coach'), stadiumController.getStadiumsByCoachSports);

// Route to update a stadium (restricted to stadium owners)
router.put('/:id', protect, restrictTo('stadiumOwner'), stadiumController.updateStadium);

// Route to delete a stadium (restricted to stadium owners)
router.delete('/:id', protect, restrictTo('stadiumOwner'), stadiumController.deleteStadium);

module.exports = router;

