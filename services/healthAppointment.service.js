const { HealthAppointment } = require('../models');
const nodemailer = require('nodemailer');
const { pool } = require('../config/db');
const moment = require('moment-timezone');




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
  // ➕ store the exact moment the officer clicked “Approve”
  if (status.toLowerCase() === 'approved') {
      const colomboTime = moment().tz('Asia/Colombo').toDate();
    console.log('🕒 Colombo Time:', colomboTime); // ✅ This is the key log
    appointment.approved_at = colomboTime;
  } else {
    appointment.approved_at = null; // reset if it gets rejected again
  }

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
      text: `Hello Champion,

🎉 Your PlayFit health-appointment request has been **${status.toUpperCase()}**! 🎉

––––––––––––––––––––––
📅 Date: ${appointment.appointment_date}  
🕒 Time: ${appointment.appointment_time}  
🏥 Reason: ${appointment.reason}  
––––––––––––––––––––––

If accepted, please arrive 10 minutes early and bring your ID.  
If rejected, we’ll gladly help you reschedule—just reply to this message.

Stay fit, stay healthy,  
💪 The PlayFit Team`
      
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent`);
  }

  exports.getApprovedAppointments = async (healthOfficerId) => {
  return await HealthAppointment.findAll({
    where: {
      health_officer_id: healthOfficerId,
      status: 'Approved'
    },
     order: [
      ['appointment_date', 'ASC'],
      ['appointment_time', 'ASC']
    ]
  });
};

exports.getApprovedAppointmentsWithDetails = async (healthOfficerId) => {
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
    WHERE ha.health_officer_id = ? AND ha.status = 'Approved'
    ORDER BY ha.appointment_date ASC, ha.appointment_time ASC
  `;
  
  const [appointments] = await pool.execute(query, [healthOfficerId]);
  return appointments;
};
  
