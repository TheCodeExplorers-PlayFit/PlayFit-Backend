const { pool } = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Helper function to execute SQL with parameters
async function executeQuery(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

// Generate 6-digit verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Register user
exports.registerUser = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      console.log('Received registration data:', req.body);
      const { 
        firstName = null, 
        lastName = null, 
        email = null, 
        password = null, 
        role = null,
        mobileNumber = null, 
        age = null, 
        gender = null, 
        nic = null
      } = req.body;
      
      if (!firstName || !lastName || !email || !password || !role) {
        throw new Error('Missing required fields: firstName, lastName, email, password, or role');
      }

      // Check for existing email
      const existingUsers = await executeQuery('SELECT email FROM users WHERE email = ?', [email]);
      if (existingUsers.length > 0) {
        throw new Error('Email already registered');
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Generate verification code and expiration
      const verificationCode = generateVerificationCode();
      const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      
      const [result] = await connection.execute(
        `INSERT INTO users (first_Name, last_Name, email, password, role, mobile_Number, age, gender, nic, verificationCode, verificationCodeExpires) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [firstName, lastName, email, hashedPassword, role, mobileNumber, age, gender, nic, verificationCode, verificationCodeExpires]
      );
      
      const userId = result.insertId;
      
      // Handle role-specific details
      switch (role) {
        case 'player': {
          const { hasHealthIssues = false, healthIssuesDescription = null } = req.body;
          await connection.execute(
            `INSERT INTO player_details (userId, hasHealthIssues, healthIssuesDescription) 
             VALUES (?, ?, ?)`,
            [userId, hasHealthIssues, healthIssuesDescription]
          );
          break;
        }
        case 'medicalOfficer': {
          const { documentPath = null, additionalInfo = null } = req.body;
          await connection.execute(
            `INSERT INTO medical_officer_details (userId, documentPath, additionalInfo) 
             VALUES (?, ?, ?)`,
            [userId, documentPath, additionalInfo]
          );
          break;
        }
        case 'coach': {
          const { sport1 = null, sport2 = null, sport3 = null, experience = null, documentPath = null } = req.body;
          if (!sport1 || !experience) {
            throw new Error('Missing required fields for coach: sport1, experience');
          }
          const [sport1Exists] = await connection.execute('SELECT id FROM sports WHERE id = ?', [sport1]);
          if (sport1Exists.length === 0) {
            throw new Error('Invalid sport1 ID');
          }
          if (sport2) {
            const [sport2Exists] = await connection.execute('SELECT id FROM sports WHERE id = ?', [sport2]);
            if (sport2Exists.length === 0) {
              throw new Error('Invalid sport2 ID');
            }
          }
          if (sport3) {
            const [sport3Exists] = await connection.execute('SELECT id FROM sports WHERE id = ?', [sport3]);
            if (sport3Exists.length === 0) {
              throw new Error('Invalid sport3 ID');
            }
          }
          await connection.execute(
            `INSERT INTO coach_details (userId, sport1, sport2, sport3, experience, documentPath)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, sport1, sport2, sport3, experience, documentPath]
          );
          break;
        }
        case 'stadiumOwner': {
          const { facilityName = null, facilityAddress = null } = req.body;
          if (!facilityName || !facilityAddress) {
            throw new Error('Missing required fields for stadiumOwner: facilityName or facilityAddress');
          }
          await connection.execute(
            `INSERT INTO stadium_owner_details (userId, facilityName, facilityAddress) 
             VALUES (?, ?, ?)`,
            [userId, facilityName, facilityAddress]
          );
          break;
        }
      }
      
      await connection.commit();
      
      res.status(201).json({
        success: true,
        message: 'User registered, verification code sent',
        verificationCode,
        user: {
          id: userId,
          firstName,
          lastName,
          email,
          role
        }
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Registration error:', error);
    if (error.message === 'Email already registered' || error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({
        success: false,
        message: 'Email already registered',
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to register user',
        error: error.message
      });
    }
  }
};

// Verify email code
exports.verifyEmail = async (req, res) => {
  try {
    const { email, verificationCode } = req.body;
    
    if (!email || !verificationCode) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required'
      });
    }
    
    const users = await executeQuery(
      'SELECT verificationCode, verificationCodeExpires, isVerified FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = users[0];
    
    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }
    
    if (user.verificationCode !== verificationCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }
    
    if (new Date(user.verificationCodeExpires) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Verification code expired'
      });
    }
    
    // Update user as verified
    await executeQuery(
      'UPDATE users SET isVerified = 1, verificationCode = NULL, verificationCodeExpires = NULL WHERE email = ?',
      [email]
    );
    
    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify email',
      error: error.message
    });
  }
};

// Forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const users = await executeQuery('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    if (!user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email not verified'
      });
    }

    // Generate reset code and expiration
    const resetCode = generateVerificationCode();
    const resetCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Update user with reset code
    await executeQuery(
      'UPDATE users SET verificationCode = ?, verificationCodeExpires = ? WHERE email = ?',
      [resetCode, resetCodeExpires, email]
    );

    res.status(200).json({
      success: true,
      message: 'Reset code sent to email',
      resetCode,
      user: {
        firstName: user.first_Name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process forgot password request',
      error: error.message
    });
  }
};

// Verify reset code
exports.verifyResetCode = async (req, res) => {
  try {
    const { email, resetCode } = req.body;

    if (!email || !resetCode) {
      return res.status(400).json({
        success: false,
        message: 'Email and reset code are required'
      });
    }

    const users = await executeQuery(
      'SELECT verificationCode, verificationCodeExpires FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    if (user.verificationCode !== resetCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset code'
      });
    }

    if (new Date(user.verificationCodeExpires) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Reset code expired'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Reset code verified successfully'
    });
  } catch (error) {
    console.error('Reset code verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify reset code',
      error: error.message
    });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email and new password are required'
      });
    }

    const users = await executeQuery('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await executeQuery(
      'UPDATE users SET password = ?, verificationCode = NULL, verificationCodeExpires = NULL WHERE email = ?',
      [hashedPassword, email]
    );

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: error.message
    });
  }
};

// Login user
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    const users = await executeQuery('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    const user = users[0];
    
    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        message: 'Email not verified'
      });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('Generated JWT token (login):', token);
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        firstName: user.first_Name,
        lastName: user.last_Name,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to login',
      error: error.message
    });
  }
};

// Get sports
exports.getSports = async (req, res) => {
  try {
    const sports = await executeQuery('SELECT id, name FROM sports');
    res.status(200).json({
      success: true,
      sports
    });
  } catch (error) {
    console.error('Error fetching sports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sports',
      error: error.message
    });
  }
};