const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const { addPlayerPackage, assignPlayerToPackage, getPlayerPackages, getPlayerPackageAssignments, updatePlayerPackage, deletePlayerPackage, getSubscriptionStats } = require('../controllers/playerPackageController');

router.use(protect);
router.use(restrictTo('stadiumOwner'));

router.post('/add', addPlayerPackage);
router.get('/', getPlayerPackages);
router.get('/assignments', getPlayerPackageAssignments);
router.put('/:id', updatePlayerPackage);
router.delete('/:id', deletePlayerPackage);
router.get('/stats', getSubscriptionStats);

router.post('/assign', protect, restrictTo('player'), assignPlayerToPackage);

module.exports = router;