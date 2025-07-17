// models/HealthTip.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const HealthOfficer = require('./healthOfficer');
const Question = require('./Question');

const HealthTip = sequelize.define('HealthTip', {
  id: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true 
  },
  title: { 
    type: DataTypes.STRING(100), 
    allowNull: false 
  },
  category: {
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
  image_url: { 
    type: DataTypes.STRING,
    allowNull: true
  },
  healthOfficer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'health_tips',
  timestamps: false
});

module.exports = HealthTip;
HealthTip.hasMany(Question, { foreignKey: 'health_tip_id' });
Question.belongsTo(HealthTip, { foreignKey: 'health_tip_id' });

