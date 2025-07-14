const healthAppointmentService = require("../services/healthAppointment.service");
const { pool } = require('../config/db');
exports.getAppointmentsByOfficerId = async (req, res) => {
  try {
    const { healthOfficerId } = req.params;
    const appointments =
      await healthAppointmentService.getAppointmentsByOfficerId(
        healthOfficerId
      );

    res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
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
        message: "healthAppointmentId and status are required",
      });
    }

    const updatedAppointment =
      await healthAppointmentService.updateAppointmentStatus(
        healthAppointmentId,
        status
      );

    if (!updatedAppointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Appointment status updated successfully",
      data: updatedAppointment,
    });
  } catch (error) {
    console.error("Error updating appointment status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update appointment status",
    });
  }
};

exports.getApprovedAppointments = async (req, res) => {
  try {
    const { healthOfficerId } = req.params;

    const approved = await healthAppointmentService.getApprovedAppointments(
      healthOfficerId
    );

    res.status(200).json({ success: true, data: approved });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch approved appointments",
      });
  }
};

// NEW CONTROLLER: Get appointment by ID with user details
exports.getAppointmentById = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    console.log('getAppointmentById: Fetching appointment details for ID:', appointmentId);
    
    const query = `
      SELECT 
        ha.*,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        u.mobile_number,
        u.age,
        u.gender,
        u.nic
      FROM healthappointments ha
      JOIN users u ON ha.player_id = u.id
      WHERE ha.id = ?
    `;
    
    const [appointment] = await pool.execute(query, [appointmentId]);

    if (!appointment.length) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    res.status(200).json({
      success: true,
      data: appointment[0],
    });
  } catch (error) {
    console.error('getAppointmentById: Error fetching appointment:', error.message, error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment details',
    });
  }
};


// NEW CONTROLLER: Get all appointments with user details for a health officer
exports.getAppointmentsWithUserDetails = async (req, res) => {
  try {
    const { healthOfficerId } = req.params;
    console.log('getAppointmentsWithUserDetails: Fetching appointments with user details for officer ID:', healthOfficerId);
    
    const query = `
      SELECT 
        ha.*,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        u.mobile_number,
        u.age,
        u.gender,
        u.nic
      FROM healthappointments ha
      JOIN users u ON ha.player_id = u.id
      WHERE ha.health_officer_id = ?
    `;
    
    const [appointments] = await pool.execute(query, [healthOfficerId]);

    res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    console.error('getAppointmentsWithUserDetails: Error fetching appointments:', error.message, error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments with user details',
    });
  }
};

// NEW CONTROLLER: Get approved appointments with user details
exports.getApprovedAppointmentsWithUserDetails = async (req, res) => {
  try {
    const { healthOfficerId } = req.params;
    console.log('getApprovedAppointmentsWithUserDetails: Fetching approved appointments with user details for officer ID:', healthOfficerId);
    
    const query = `
      SELECT 
        ha.*,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        u.mobile_number,
        u.age,
        u.gender,
        u.nic
      FROM healthappointments ha
      JOIN users u ON ha.player_id = u.id
      WHERE ha.health_officer_id = ? AND ha.status = 'approved'
    `;
    
    const [approved] = await pool.execute(query, [healthOfficerId]);

    res.status(200).json({ 
      success: true, 
      data: approved 
    });
  } catch (error) {
    console.error('getApprovedAppointmentsWithUserDetails: Error fetching approved appointments:', error.message, error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch approved appointments with user details'
    });
  }
};
