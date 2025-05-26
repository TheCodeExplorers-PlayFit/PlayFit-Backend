/// File: models/injury.model.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Injury = sequelize.define('Injury', {
  player_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  player_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  date_of_injury: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  time_of_injury: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  type_of_injury: {
    type: DataTypes.STRING,
    allowNull: false,
  },
injury_severity: {
    type: DataTypes.ENUM('Minor', 'Moderate', 'Severe', 'Critical'), // ✅ Match this exactly
    defaultValue: 'Minor',
  },
  first_aid_given: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  health_officer_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  treatment_plan: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
medical_files: {
  type: DataTypes.STRING,
  allowNull: true,
}

});

module.exports = Injury;