const { HealthAppointment } = require('../models');

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
  
    return appointment;          // Return updated appointment
  };