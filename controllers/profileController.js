const { sequelize } = require('../config/db');
const { QueryTypes } = require('sequelize');

exports.getProfile = async (req, res) => {
  try {
    const user = await sequelize.query(
      'SELECT id, first_name as firstName, last_name as lastName, email, role, mobile_number, age, profile_picture FROM users WHERE id = ?',
      { replacements: [req.user.id], type: QueryTypes.SELECT }
    );
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json(user[0]);
  } catch (error) {
    console.error('Error in getProfile:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  const { firstName, lastName, mobile_number } = req.body;
  try {
    await sequelize.query(
      'UPDATE users SET first_name = ?, last_name = ?, mobile_number = ? WHERE id = ?',
      {
        replacements: [firstName, lastName, mobile_number, req.user.id],
        type: QueryTypes.UPDATE,
      }
    );
    res.status(200).json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error in updateProfile:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.updateProfilePicture = async (req, res) => {
  const { profile_picture } = req.body;
  try {
    await sequelize.query(
      'UPDATE users SET profile_picture = ? WHERE id = ?',
      {
        replacements: [profile_picture, req.user.id],
        type: QueryTypes.UPDATE,
      }
    );
    res.status(200).json({ success: true, message: 'Profile picture updated successfully' });
  } catch (error) {
    console.error('Error in updateProfilePicture:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.searchUsers = async (req, res) => {
  const { term } = req.query;
  try {
    const users = await sequelize.query(
      `SELECT id, first_name as firstName, last_name as lastName, email, role, mobile_number, age, profile_picture 
       FROM users 
       WHERE first_name LIKE ? OR last_name LIKE ?`,
      {
        replacements: [`%${term}%`, `%${term}%`],
        type: QueryTypes.SELECT,
      }
    );
    res.status(200).json(users);
  } catch (error) {
    console.error('Error in searchUsers:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};