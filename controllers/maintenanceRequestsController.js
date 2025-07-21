const MaintenanceRequestsModel = require('../models/MaintenanceRequestsModel');

exports.getMaintenanceRequests = async (req, res) => {
  const ownerId = req.user?.id;

  if (!ownerId) {
    return res.status(400).json({ success: false, message: 'Owner ID is missing' });
  }

  try {
    const requests = await MaintenanceRequestsModel.getMaintenanceRequestsByOwner(ownerId);
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching maintenance requests:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


exports.updateMaintenanceRequest = async (req, res) => {
  const { id, status } = req.body;
  try {
    const result = await MaintenanceRequestsModel.updateMaintenanceRequest(id, status);
    res.json(result);
  } catch (error) {
    const statusCode = error.message.includes('not found') ? 404 : 400;
    res.status(statusCode).json({ error: error.message });
  }
};