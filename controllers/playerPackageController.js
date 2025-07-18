const PlayerPackageModel = require('../models/PlayerPackageModel');

async function addPlayerPackage(req, res) {
  try {
    const { name, description, price, duration, sport, stadiumId, start_date, end_date } = req.body;
    console.log('Received player package data:', { name, description, price, duration, sport, stadiumId, start_date, end_date });
    if (!name || !price || !duration || !sport || !stadiumId || !start_date || !end_date) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const result = await PlayerPackageModel.addPlayerPackage({ 
      name, description, price, duration, sport, stadiumId, start_date, end_date, ownerId: req.user.id 
    });
    res.status(201).json({ message: 'Player package added successfully', packageId: result.packageId });
  } catch (error) {
    console.error('Error adding player package:', error);
    res.status(error.message.includes('Unauthorized') ? 403 : 500).json({ message: 'Error adding player package', error: error.message });
  }
}

async function assignPlayerToPackage(req, res) {
  try {
    const { packageId, start_date, end_date } = req.body;
    if (!packageId || !start_date || !end_date) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const result = await PlayerPackageModel.assignPlayerToPackage({ packageId, start_date, end_date, playerId: req.user.id });
    res.status(201).json(result);
  } catch (error) {
    console.error('Error assigning package to player:', error);
    res.status(error.message.includes('Package not found') ? 404 : 500).json({ message: 'Error assigning package to player', error: error.message });
  }
}

async function getPlayerPackages(req, res) {
  try {
    const packages = await PlayerPackageModel.getPlayerPackages(req.user.id);
    res.status(200).json(packages);
  } catch (error) {
    console.error('Error fetching player packages:', error);
    res.status(500).json({ message: 'Error fetching player packages', error: error.message });
  }
}

async function getPlayerPackageAssignments(req, res) {
  try {
    const assignments = await PlayerPackageModel.getPlayerPackageAssignments(req.user.id);
    res.status(200).json(assignments);
  } catch (error) {
    console.error('Error fetching player package assignments:', error);
    res.status(500).json({ message: 'Error fetching player package assignments', error: error.message });
  }
}

async function updatePlayerPackage(req, res) {
  try {
    const { id, name, description, price, duration, sport, stadiumId, start_date, end_date } = req.body;
    console.log('Updating player package with data:', { id, name, description, price, duration, sport, stadiumId, start_date, end_date });
    if (!id || !name || !price || !duration || !sport || !stadiumId || !start_date || !end_date) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const result = await PlayerPackageModel.updatePlayerPackage({ 
      id, name, description, price, duration, sport, stadiumId, start_date, end_date, ownerId: req.user.id 
    });
    res.status(200).json(result);
  } catch (error) {
    console.error('Error updating player package:', error);
    res.status(error.message.includes('Unauthorized') || error.message.includes('not found') ? 403 : 500).json({ message: 'Error updating player package', error: error.message });
  }
}

async function deletePlayerPackage(req, res) {
  try {
    const { id } = req.params;
    console.log('Deleting player package with id:', id);
    const result = await PlayerPackageModel.deletePlayerPackage(id, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error deleting player package:', error);
    res.status(error.message.includes('Unauthorized') ? 403 : 500).json({ message: 'Error deleting player package', error: error.message });
  }
}

async function getSubscriptionStats(req, res) {
  try {
    const stats = await PlayerPackageModel.getSubscriptionStats(req.user.id);
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching subscription stats:', error);
    res.status(500).json({ message: 'Error fetching subscription stats', error: error.message });
  }
}

module.exports = {
  addPlayerPackage,
  assignPlayerToPackage,
  getPlayerPackages,
  getPlayerPackageAssignments,
  updatePlayerPackage,
  deletePlayerPackage,
  getSubscriptionStats
};