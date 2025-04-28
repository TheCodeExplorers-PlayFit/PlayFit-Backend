const healthAppointmentService = require('../services/healthAppointment.service');

exports.getAppointmentsByOfficerId = async (req, res) => {
  try {
    const { healthOfficerId } = req.params;
    const appointments = await healthAppointmentService.getAppointmentsByOfficerId(healthOfficerId);

    res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',
    });
  }
};
