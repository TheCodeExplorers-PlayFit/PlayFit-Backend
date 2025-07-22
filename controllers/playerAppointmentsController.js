const { sequelize } = require('../config/db');
const { QueryTypes } = require('sequelize');

exports.searchHealthOfficers = async (req, res) => {
  try {
    const { name } = req.query;
    let query = 'SELECT id, name, userId, isVerified FROM healthofficers';
    const replacements = {};

    if (name) {
      query += ' WHERE name LIKE :name';
      replacements.name = `%${name}%`;
    }

    const healthOfficers = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT,
    });

    res.status(200).json({
      success: true,
      healthOfficers,
    });
  } catch (error) {
    console.error('Error searching health officers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

exports.createAppointment = async (req, res) => {
  try {
    const { health_officer_id, appointment_date, appointment_time, reason } = req.body;
    const player_id = req.user.id;

    // Validate health officer exists
    const healthOfficer = await sequelize.query(
      'SELECT id FROM healthofficers WHERE id = :health_officer_id',
      {
        replacements: { health_officer_id },
        type: QueryTypes.SELECT,
      }
    );

    if (!healthOfficer.length) {
      return res.status(404).json({
        success: false,
        message: 'Health officer not found',
      });
    }

    // Insert appointment without player_name and player_email (since those columns do not exist in table)
    const [appointment] = await sequelize.query(
      `INSERT INTO healthappointments 
         (player_id, health_officer_id, appointment_date, appointment_time, reason, status, action)
       VALUES 
         (:player_id, :health_officer_id, :appointment_date, :appointment_time, :reason, 'pending', NULL)`,
      {
        replacements: {
          player_id,
          health_officer_id,
          appointment_date,
          appointment_time,
          reason,
        },
        type: QueryTypes.INSERT,
      }
    );

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      appointmentId: appointment,
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

exports.getPlayerAppointments = async (req, res) => {
  try {
    const player_id = req.user.id;

    // Join with users table to get player's name and email
    const appointments = await sequelize.query(
      `SELECT 
        ha.id, 
        ha.appointment_date, 
        ha.appointment_time, 
        ha.reason, 
        ha.status,
        CONCAT(u.first_name, ' ', u.last_name) AS player_name,  -- combine first and last names
        u.email AS player_email,
        ho.name AS health_officer_name
        FROM healthappointments ha
        JOIN healthofficers ho ON ha.health_officer_id = ho.id
        JOIN users u ON ha.player_id = u.id
        WHERE ha.player_id = :player_id
        ORDER BY ha.appointment_date DESC, ha.appointment_time DESC;`,
      {
        replacements: { player_id },
        type: QueryTypes.SELECT,
      }
    );

    res.status(200).json({
      success: true,
      appointments,
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
