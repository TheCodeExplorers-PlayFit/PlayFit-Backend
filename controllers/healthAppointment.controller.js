const healthAppointmentService = require("../services/healthAppointment.service");
const { pool } = require('../config/db');
const { HealthAppointment } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

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
        u.nic,
         ha.appointment_date,
        ha.appointment_time,
        ha.approved_at         
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

// FIXED: Weekly appointments summary using Sequelize (properly handles GROUP BY)
exports.getWeeklyAppointmentsSummary = async (req, res) => {
  try {
    const { healthOfficerId } = req.params;
    console.log('getWeeklyAppointmentsSummary: Fetching for officer ID:', healthOfficerId);

    // First check if appointments exist
    const totalCount = await HealthAppointment.count({
      where: { health_officer_id: healthOfficerId }
    });
    console.log('Total appointments for officer:', totalCount);

    if (totalCount === 0) {
      return res.status(200).json({ 
        success: true, 
        data: [],
        message: 'No appointments found for this health officer'
      });
    }

    // Get weekly summary using Sequelize with proper GROUP BY
    const appointments = await HealthAppointment.findAll({
      attributes: [
        [fn('YEARWEEK', col('appointment_date'), 1), 'week_key'],
        [fn('WEEK', col('appointment_date'), 1), 'week_number'],
        [fn('COUNT', '*'), 'total'],
        [fn('MIN', col('appointment_date')), 'week_start'],
        [fn('MAX', col('appointment_date')), 'week_end']
      ],
      where: {
        health_officer_id: healthOfficerId,
        appointment_date: {
          [Op.gte]: literal('DATE_SUB(NOW(), INTERVAL 8 WEEK)')
        }
      },
      group: [literal('YEARWEEK(appointment_date, 1)')],
      order: [[literal('YEARWEEK(appointment_date, 1)'), 'ASC']],
      raw: true
    });

    console.log('Weekly appointments raw data:', appointments);

    if (!appointments || appointments.length === 0) {
      return res.status(200).json({ 
        success: true, 
        data: [],
        message: 'No appointments found in the last 8 weeks'
      });
    }

    // Transform the data
    const result = appointments.map((row, index) => ({
      week: `Week ${index + 1}`,
      total: parseInt(row.total),
      week_start: row.week_start,
      week_end: row.week_end,
      week_key: row.week_key,
      week_number: row.week_number
    }));

    console.log('Transformed weekly data:', result);

    res.status(200).json({ 
      success: true, 
      data: result,
      totalWeeks: result.length
    });

  } catch (error) {
    console.error('Error fetching weekly appointments:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching weekly appointments',
      error: error.message
    });
  }
};

// ALTERNATIVE: Using Raw SQL (if Sequelize doesn't work)
exports.getWeeklyAppointmentsSummaryRaw = async (req, res) => {
  try {
    const { healthOfficerId } = req.params;
    console.log('getWeeklyAppointmentsSummaryRaw: Fetching for officer ID:', healthOfficerId);

    // First check if appointments exist
    const countQuery = `SELECT COUNT(*) as total FROM healthappointments WHERE health_officer_id = ?`;
    const [countResult] = await pool.execute(countQuery, [healthOfficerId]);
    console.log('Total appointments for officer:', countResult[0].total);

    if (countResult[0].total === 0) {
      return res.status(200).json({ 
        success: true, 
        data: [],
        message: 'No appointments found for this health officer'
      });
    }

    // Fixed SQL query that properly groups all selected columns
    const query = `
      SELECT 
        YEARWEEK(appointment_date, 1) as week_key,
        WEEK(appointment_date, 1) as week_number,
        COUNT(*) as total,
        MIN(appointment_date) as week_start,
        MAX(appointment_date) as week_end
      FROM healthappointments 
      WHERE health_officer_id = ?
        AND appointment_date >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
      GROUP BY YEARWEEK(appointment_date, 1), WEEK(appointment_date, 1)
      ORDER BY YEARWEEK(appointment_date, 1) ASC
    `;
    
    const [appointments] = await pool.execute(query, [healthOfficerId]);
    console.log('Weekly appointments raw data:', appointments);

    if (!appointments || appointments.length === 0) {
      return res.status(200).json({ 
        success: true, 
        data: [],
        message: 'No appointments found in the last 8 weeks'
      });
    }

    // Transform the data
    const result = appointments.map((row, index) => ({
      week: `Week ${index + 1}`,
      total: parseInt(row.total),
      week_start: row.week_start,
      week_end: row.week_end,
      week_key: row.week_key,
      week_number: row.week_number
    }));

    console.log('Transformed weekly data:', result);

    res.status(200).json({ 
      success: true, 
      data: result,
      totalWeeks: result.length
    });

  } catch (error) {
    console.error('Error fetching weekly appointments:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching weekly appointments',
      error: error.message
    });
  }
};

// SIMPLEST VERSION: Just get summary data without individual dates
exports.getWeeklyAppointmentsSummarySimple = async (req, res) => {
  try {
    const { healthOfficerId } = req.params;
    console.log('getWeeklyAppointmentsSummarySimple: Fetching for officer ID:', healthOfficerId);

    // Using Sequelize - only select aggregated data
    const appointments = await HealthAppointment.findAll({
      attributes: [
        [fn('YEARWEEK', col('appointment_date'), 1), 'week_key'],
        [fn('COUNT', '*'), 'total']
      ],
      where: {
        health_officer_id: healthOfficerId,
        appointment_date: {
          [Op.gte]: literal('DATE_SUB(NOW(), INTERVAL 8 WEEK)')
        }
      },
      group: [literal('YEARWEEK(appointment_date, 1)')],
      order: [[literal('YEARWEEK(appointment_date, 1)'), 'ASC']],
      raw: true
    });

    console.log('Simple weekly appointments data:', appointments);

    if (!appointments || appointments.length === 0) {
      return res.status(200).json({ 
        success: true, 
        data: [],
        message: 'No appointments found in the last 8 weeks'
      });
    }

    // Transform the data
    const result = appointments.map((row, index) => ({
      week: `Week ${index + 1}`,
      total: parseInt(row.total),
      week_key: row.week_key
    }));

    console.log('Transformed simple weekly data:', result);

    res.status(200).json({ 
      success: true, 
      data: result,
      totalWeeks: result.length
    });

  } catch (error) {
    console.error('Error fetching weekly appointments:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching weekly appointments',
      error: error.message
    });
  }
};

// DEBUG: Check appointment data
exports.debugAppointmentData = async (req, res) => {
  try {
    const { healthOfficerId } = req.params;
    console.log('debugAppointmentData: Checking data for officer ID:', healthOfficerId);

    const queries = [
      // Check total appointments
      `SELECT COUNT(*) as total FROM healthappointments WHERE health_officer_id = ?`,
      
      // Check date range
      `SELECT 
        MIN(appointment_date) as earliest_date,
        MAX(appointment_date) as latest_date,
        COUNT(*) as total
      FROM healthappointments 
      WHERE health_officer_id = ?`,
      
      // Check recent appointments
      `SELECT 
        appointment_date,
        COUNT(*) as count
      FROM healthappointments 
      WHERE health_officer_id = ? 
      GROUP BY appointment_date 
      ORDER BY appointment_date DESC 
      LIMIT 10`
    ];

    const results = {};
    
    for (let i = 0; i < queries.length; i++) {
      const [result] = await pool.execute(queries[i], [healthOfficerId]);
      results[`query_${i + 1}`] = result;
    }

    res.status(200).json({ 
      success: true, 
      debug_data: results
    });

  } catch (error) {
    console.error('Error in debug query:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error in debug query',
      error: error.message
    });
  }
};


// NEW CONTROLLER: Get today's appointments with user details
exports.getTodaysAppointments = async (req, res) => {
  try {
    const { healthOfficerId } = req.params;
    console.log('getTodaysAppointments: Fetching today\'s appointments for officer ID:', healthOfficerId);
    
    const query = `
      SELECT 
        ha.id,
        ha.appointment_time,
        ha.reason,
        ha.status,
        ha.appointment_date,
        u.first_name,
        u.last_name,
        u.email,
        u.mobile_number
      FROM healthappointments ha
      JOIN users u ON ha.player_id = u.id
      WHERE ha.health_officer_id = ? 
        AND DATE(ha.appointment_date) = CURDATE()
      ORDER BY ha.appointment_time ASC
    `;
    
    const [appointments] = await pool.execute(query, [healthOfficerId]);

    // Transform the data to match frontend interface
    const transformedAppointments = appointments.map(appointment => ({
      id: appointment.id.toString(),
      time: formatTime(appointment.appointment_time),
      name: `${appointment.first_name} ${appointment.last_name}`,
      reason: appointment.reason || 'General Consultation',
      status: capitalizeStatus(appointment.status || 'scheduled'),
      avatar: generateAvatarUrl(appointment.first_name, appointment.last_name),
      email: appointment.email,
      mobile_number: appointment.mobile_number
    }));

    res.status(200).json({ 
      success: true, 
      data: transformedAppointments 
    });
  } catch (error) {
    console.error('getTodaysAppointments: Error fetching today\'s appointments:', error.message, error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch today\'s appointments'
    });
  }
};

// Helper function to format time from HH:mm:ss to readable format
function formatTime(timeString) {
  if (!timeString) return 'N/A';
  
  try {
    const [hours, minutes] = timeString.split(':');
    const hour12 = parseInt(hours) % 12 || 12;
    const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  } catch (error) {
    return timeString; // Return original if parsing fails
  }
}

// Helper function to capitalize status
function capitalizeStatus(status) {
  if (!status) return 'Scheduled';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

// Helper function to generate avatar URL (you can customize this)
function generateAvatarUrl(firstName, lastName) {
  // Option 1: Use a service like UI Avatars
  const initials = `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=6200EE&color=fff&size=128`;
  
  // Option 2: Use local default avatar
  // return 'assets/images/avatars/default-avatar.jpg';
}

// NEW CONTROLLER: Get appointments count for dashboard stats
exports.getAppointmentStats = async (req, res) => {
  try {
    const { healthOfficerId } = req.params;
    console.log('getAppointmentStats: Fetching stats for officer ID:', healthOfficerId);
    
    const queries = {
      total: `SELECT COUNT(*) as count FROM healthappointments WHERE health_officer_id = ?`,
      today: `SELECT COUNT(*) as count FROM healthappointments WHERE health_officer_id = ? AND DATE(appointment_date) = CURDATE()`,
      thisWeek: `SELECT COUNT(*) as count FROM healthappointments WHERE health_officer_id = ? AND YEARWEEK(appointment_date, 1) = YEARWEEK(CURDATE(), 1)`,
      approved: `SELECT COUNT(*) as count FROM healthappointments WHERE health_officer_id = ? AND status = 'approved'`
    };

    const stats = {};
    
    for (const [key, query] of Object.entries(queries)) {
      const [result] = await pool.execute(query, [healthOfficerId]);
      stats[key] = result[0].count;
    }

    res.status(200).json({ 
      success: true, 
      data: stats 
    });
  } catch (error) {
    console.error('getAppointmentStats: Error fetching stats:', error.message, error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch appointment stats'
    });
  }
};
