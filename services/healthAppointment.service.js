const { HealthAppointment } = require('../models');

exports.getAppointmentsByOfficerId = async (healthOfficerId) => {
  const appointments = await HealthAppointment.findAll({
     where: { health_officer_id: healthOfficerId } 
  });
  
  return appointments;
};
