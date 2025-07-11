const { HealthOfficer } = require('../models');

exports.createHealthOfficer = async (officerData) => {
  const newOfficer = await HealthOfficer.create(officerData);
  return newOfficer;
};
