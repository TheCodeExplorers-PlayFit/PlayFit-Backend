const healthOfficerService = require('../services/healthOfficer.service');

exports.createHealthOfficer = async (req, res) => {
  try {
    const officerData = req.body;
    const newOfficer = await healthOfficerService.createHealthOfficer(officerData);

    res.status(201).json({
      success: true,
      data: newOfficer,
      message: 'Health Officer created successfully'
    });
  } catch (error) {
    console.error('Error creating Health Officer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create Health Officer'
    });
  }
};
