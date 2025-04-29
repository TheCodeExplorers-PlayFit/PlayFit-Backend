const jwt = require('jsonwebtoken');
const pool = require('../config/db');

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route: No token provided'
      });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route: Invalid or expired token'
      });
    }
    try {
      const [users] = await pool.execute(
        'SELECT id, first_name, last_name, email, role FROM users WHERE id = ?',
        [decoded.id]
      );
      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      req.user = users[0];
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Server error: Failed to authenticate user'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};