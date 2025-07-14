// models/HealthTip.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const HealthTip = sequelize.define('HealthTip', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  ategory: {  
    type: DataTypes.ENUM(
      'Public Health & Safety',
      'Injury Prevention & First Aid',
      'Mental Health & Well-being',
      'Nutrition & Diet',
      'Chronic Disease Management',
      'Fitness & Physical Activity',
      'Workplace & Occupational Health'
    ),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'health_tips',
  timestamps: false
});

module.exports = HealthTip;
