const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const { addPlayerPackage, getPlayerPackages, updatePlayerPackage, deletePlayerPackage } = require('../controllers/playerPackageController');

router.use(protect);
router.use(restrictTo('stadiumOwner'));

router.post('/add', addPlayerPackage);
router.get('/', getPlayerPackages);
router.put('/:id', updatePlayerPackage);
router.delete('/:id', deletePlayerPackage);

module.exports = router;