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

//  New method: Update appointment status by appointment ID
exports.updateAppointmentStatus = async (req, res) => {
    try {
      const { healthAppointmentId, status } = req.body;
  
      if (!healthAppointmentId || !status) {
        return res.status(400).json({
          success: false,
          message: 'healthAppointmentId and status are required',
        });
      }
  
      const updatedAppointment = await healthAppointmentService.updateAppointmentStatus(healthAppointmentId, status);
  
      if (!updatedAppointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found',
        });
      }
  
      res.status(200).json({
        success: true,
        message: 'Appointment status updated successfully',
        data: updatedAppointment,
      });
  
    } catch (error) {
      console.error('Error updating appointment status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update appointment status',
      });
    }
  };