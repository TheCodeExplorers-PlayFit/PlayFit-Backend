// File: models/HealthOfficer.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const HealthOfficer = sequelize.define('HealthOfficer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  documentPath: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  additionalInfo: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  }
}, {
  timestamps: false
});

module.exports = HealthOfficer;
