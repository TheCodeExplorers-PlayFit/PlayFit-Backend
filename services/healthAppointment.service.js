const { HealthAppointment } = require('../models');
const nodemailer = require('nodemailer');

const { pool } = require('../config/db');
exports.getAppointmentsByOfficerId = async (healthOfficerId) => {
  const appointments = await HealthAppointment.findAll({
     where: { health_officer_id: healthOfficerId } 
  });
  
  return appointments;
};


//  New method: Update appointment status by Appointment ID
exports.updateAppointmentStatus = async (healthAppointmentId, status) => {
  // Find appointment by ID using Sequelize
  const appointment = await HealthAppointment.findByPk(healthAppointmentId);

  if (!appointment) {
    return null; // No appointment found
  }

  // Update the status
  appointment.status = status;
  await appointment.save();

  // 🔍 Fetch user's email by joining users table using raw SQL
  const query = `
    SELECT u.email
    FROM healthappointments ha
    JOIN users u ON ha.player_id = u.id
    WHERE ha.id = ?
  `;

  try {
    const [rows] = await pool.execute(query, [healthAppointmentId]);

    if (rows.length > 0) {
      const email = rows[0].email;

      // ✉️ Send email to the player
      await sendStatusEmail(appointment, email, status);
    } else {
      console.warn(`No email found for appointment ID ${healthAppointmentId}`);
    }
  } catch (error) {
    console.error('Error fetching user email:', error.message);
  }

  return appointment;
};

  async function sendStatusEmail(appointment,email, status) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // your email address (from .env)
        pass: process.env.EMAIL_PASS  // your email password or app password
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Appointment Status Update',
      text: `Hello,
      We wanted to inform you that Your appointment has been ${status}.
      
      Details:
        - Date: ${appointment.appointment_date}
        - Time: ${appointment.appointment_time}
        - Reason: ${appointment.reason}
        
        Thank you for using PlayFit!
        
        Best regards,
        The PlayFit Team`
      
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent`);
  }

  exports.getApprovedAppointments = async (healthOfficerId) => {
  return await HealthAppointment.findAll({
    where: {
      health_officer_id: healthOfficerId,
      status: 'Approved'
    }
  });
};
  
