const { HealthAppointment } = require('../models');
const nodemailer = require('nodemailer');


exports.getAppointmentsByOfficerId = async (healthOfficerId) => {
  const appointments = await HealthAppointment.findAll({
     where: { health_officer_id: healthOfficerId } 
  });
  
  return appointments;
};

//  New method: Update appointment status by Appointment ID
exports.updateAppointmentStatus = async (healthAppointmentId, status) => {
    const appointment = await HealthAppointment.findByPk(healthAppointmentId); // Find by Primary Key
  
    if (!appointment) {
      return null; // No appointment found with this ID
    }
  
    appointment.status = status; // Update the status field
    await appointment.save();    // Save changes to the database

     // Send email to the player (assuming you have their email)
    await sendStatusEmail(appointment , status);

  
    return appointment;          // Return updated appointment
  };

  async function sendStatusEmail(appointment, status) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // your email address (from .env)
        pass: process.env.EMAIL_PASS  // your email password or app password
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: appointment.player_email,
      subject: 'Your Appointment Status Update',
      text: `Hello ${appointment.player_name},
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
    console.log(`Email sent to: ${appointment.player_email}`);
  }