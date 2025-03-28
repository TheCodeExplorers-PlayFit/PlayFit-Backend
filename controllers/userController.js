const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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

exports.registerUser = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Extract common user details with defaults to null for optional fields
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
      
      // Validate required fields for users table
      if (!firstName || !lastName || !email || !password || !role) {
        throw new Error('Missing required fields: firstName, lastName, email, password, or role');
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Insert into users table
      const [result] = await connection.execute(
        `INSERT INTO users (firstName, lastName, email, password, role, mobileNumber, age, gender, nic) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [firstName, lastName, email, hashedPassword, role, mobileNumber, age, gender, nic]
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
          const { specialization = null, experience = null } = req.body;
          await connection.execute(
            `INSERT INTO coach_details (userId, specialization, experience) 
             VALUES (?, ?, ?)`,
            [userId, specialization, experience]
          );
          break;
        }
        case 'stadiumOwner': {
          const { facilityName = null, facilityAddress = null } = req.body;
          // Validate required fields for stadiumOwner
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
      
      // Generate JWT token
      const token = jwt.sign(
        { id: userId, role },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        token,
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
    res.status(500).json({
      success: false,
      message: 'Failed to register user',
      error: error.message
    });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    // Find user by email
    const users = await executeQuery('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    const user = users[0];
    
    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
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