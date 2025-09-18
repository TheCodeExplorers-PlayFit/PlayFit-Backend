// controllers/announcementController.js
const { sequelize } = require('../config/db');
const { QueryTypes } = require('sequelize');

exports.getAllAnnouncements = async (req, res) => {
  try {
    const announcements = await sequelize.query(
      `SELECT id, category, title, description, notice_date, author, created_at 
       FROM announcements 
       ORDER BY created_at DESC`,
      { type: QueryTypes.SELECT }
    );

    res.json({
      success: true,
      announcements,
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements',
      error: error.message,
    });
  }
};
