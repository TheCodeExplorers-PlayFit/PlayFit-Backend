const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Question = sequelize.define('Question', {
  question: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  answer: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  health_tip_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'health_tips', // table name
      key: 'id'
    }
  },
  player_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users', // table name
      key: 'id'
    }
  }
}, {
  tableName: 'questions'
});

module.exports = Question;
