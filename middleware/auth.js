const jwt = require('jsonwebtoken');
const { sequelize } = require('../config/db');
const { QueryTypes } = require('sequelize');

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    console.log('Token received:', token);
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded token:', decoded);
      const users = await sequelize.query(
        'SELECT id, first_Name as firstName, last_Name as lastName, email, role FROM users WHERE id = ?',
        { replacements: [decoded.id], type: QueryTypes.SELECT }
      );
      console.log('Query result:', users);
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      req.user = users[0];
      console.log('Authenticated user:', req.user); // ✅ Add this
      next();
    } catch (error) {
      console.log('JWT Error:', error.message);
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired' });
      }
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
  } catch (error) {
    console.log('Server Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
    }
    next();
  };
};


