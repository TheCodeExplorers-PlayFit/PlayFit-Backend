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