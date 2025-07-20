const MaintenanceRequestsModel = require('../models/maintenanceRequestsModel');

exports.getMaintenanceRequests = async (req, res) => {
  try {
    const requests = await MaintenanceRequestsModel.getAllMaintenanceRequests();
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
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