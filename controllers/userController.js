const { pool } = require('../config/db');
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

// New endpoint to fetch all sports
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

exports.registerUser = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
    
      console.log('Received registration data:', req.body); // Debug log
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

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      const [result] = await connection.execute(
        `INSERT INTO users (first_Name, last_Name, email, password, role, mobile_Number, age, gender, nic) 
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
          const { sport1 = null, sport2 = null, sport3 = null, experience = null, documentPath = null } = req.body;
          console.log('Coach data received:', { sport1, sport2, sport3, experience, documentPath });
          if (!sport1 || !experience) {
            throw new Error('Missing required fields for coach: sport1, experience');
          }
          // Validate sport1 exists in sports table
          const [sport1Exists] = await connection.execute('SELECT id FROM sports WHERE id = ?', [sport1]);
          if (sport1Exists.length === 0) {
            throw new Error('Invalid sport1 ID');
          }
          // Validate sport2 and sport3 if provided
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