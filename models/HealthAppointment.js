// File: models/HealthAppointment.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const HealthOfficer = require('./healthOfficer'); // ✅ Fix case-sensitive import

const HealthAppointment = sequelize.define('HealthAppointment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  player_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  health_officer_id: {
   type: DataTypes.STRING,
       allowNull: false,
  },
  appointment_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  appointment_time: {
    type: DataTypes.TIME,
    allowNull: false
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  approved_at: {          // ← NEW
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: false,
  tableName: 'healthappointments'
});



module.exports = HealthAppointment;
