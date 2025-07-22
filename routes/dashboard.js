// routes/dashboard.js - FIXED SQL SYNTAX ERROR
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sports_app',
  connectionLimit: 10
};

// Test endpoint
router.get('/test', (req, res) => {
  console.log('Dashboard test endpoint called');
  res.json({
    success: true,
    message: 'Dashboard API is working!',
    timestamp: new Date().toISOString(),
    database: dbConfig.database
  });
});

// Get dashboard statistics from database
router.get('/dashboard-stats', async (req, res) => {
  let connection;
  try {
    console.log('Connecting to database:', dbConfig.database);
    connection = await mysql.createConnection(dbConfig);
    console.log('Database connected successfully');
    
    // Get user statistics
    const [userStats] = await connection.execute(`
      SELECT 
        COUNT(*) as totalUsers,
        SUM(CASE WHEN role = 'player' THEN 1 ELSE 0 END) as players,
        SUM(CASE WHEN role = 'coach' THEN 1 ELSE 0 END) as coaches,
        SUM(CASE WHEN role = 'stadiumOwner' THEN 1 ELSE 0 END) as stadiumOwners,
        SUM(CASE WHEN role = 'medicalOfficer' THEN 1 ELSE 0 END) as medicalOfficers
      FROM users 
      WHERE role != 'admin'
    `);
    console.log('User stats query result:', userStats[0]);
    
    // Get revenue statistics
    const [revenueStats] = await connection.execute(`
      SELECT 
        COALESCE(SUM(amount), 0) as totalRevenue,
        COUNT(*) as totalBookings
      FROM payments 
      WHERE status = 'completed' 
      AND YEAR(payment_date) = YEAR(CURDATE())
    `);
    console.log('Revenue stats query result:', revenueStats[0]);
    
    // Get monthly revenue
    const [monthlyRevenue] = await connection.execute(`
      SELECT 
        MONTH(payment_date) as month,
        COALESCE(SUM(amount), 0) as revenue
      FROM payments 
      WHERE status = 'completed' 
      AND YEAR(payment_date) = YEAR(CURDATE())
      GROUP BY MONTH(payment_date)
      ORDER BY month
    `);
    console.log('Monthly revenue query result:', monthlyRevenue);
    
    // Get injury statistics
    const [injuryStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN injury_severity = 'Minor' THEN 1 ELSE 0 END) as minor,
        SUM(CASE WHEN injury_severity = 'Moderate' THEN 1 ELSE 0 END) as moderate,
        SUM(CASE WHEN injury_severity = 'Severe' THEN 1 ELSE 0 END) as severe
      FROM injuries
      WHERE YEAR(date_of_injury) = YEAR(CURDATE())
    `);
    console.log('Injury stats query result:', injuryStats[0]);
    
    // Get rating statistics
    const [ratingStats] = await connection.execute(`
      SELECT COALESCE(AVG(rating), 0) as averageRating
      FROM ratings
      WHERE YEAR(created_at) = YEAR(CURDATE())
    `);
    console.log('Rating stats query result:', ratingStats[0]);
    
    // Get appointment statistics
    const [appointmentStats] = await connection.execute(`
      SELECT 
        (SELECT COUNT(*) FROM healthappointments WHERE YEAR(appointment_date) = YEAR(CURDATE())) as totalAppointments,
        (SELECT COUNT(*) FROM healthofficers WHERE isVerified = 1) as activeHealthOfficers
    `);
    console.log('Appointment stats query result:', appointmentStats[0]);
    
    // Process monthly revenue data
    const monthlyData = Array(12).fill(0);
    monthlyRevenue.forEach(row => {
      monthlyData[row.month - 1] = parseFloat(row.revenue);
    });
    
    const responseData = {
      users: {
        totalUsers: parseInt(userStats[0].totalUsers),
        usersByRole: {
          player: parseInt(userStats[0].players),
          coach: parseInt(userStats[0].coaches),
          stadiumOwner: parseInt(userStats[0].stadiumOwners),
          medicalOfficer: parseInt(userStats[0].medicalOfficers)
        }
      },
      revenue: {
        totalRevenue: parseFloat(revenueStats[0].totalRevenue),
        totalBookings: parseInt(revenueStats[0].totalBookings),
        monthlyRevenue: monthlyData
      },
      injuries: {
        total: parseInt(injuryStats[0].total),
        minor: parseInt(injuryStats[0].minor),
        moderate: parseInt(injuryStats[0].moderate),
        severe: parseInt(injuryStats[0].severe)
      },
      rating: {
        averageRating: parseFloat(ratingStats[0].averageRating)
      },
      appointments: {
        totalAppointments: parseInt(appointmentStats[0].totalAppointments),
        activeHealthOfficers: parseInt(appointmentStats[0].activeHealthOfficers)
      }
    };
    
    console.log('Final dashboard response data:', responseData);
    
    res.json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error.message,
      details: error.code || 'Unknown error'
    });
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
});

// Get recent activities from database - FIXED SQL ERROR
router.get('/recent-activities', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Fetching recent activities...');
    
    // Get recent user registrations
    const [users] = await connection.execute(`
      SELECT 
        'user' as type,
        CONCAT('New ', role, ' registered: ', first_name, ' ', last_name) as description,
        created_at
      FROM users 
      WHERE role != 'admin'
      AND created_at IS NOT NULL
      AND created_at != '0000-00-00 00:00:00'
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    console.log('Recent users found:', users.length);
    
    // Get recent payments - FIXED: Added missing $ symbol
    const [payments] = await connection.execute(`
      SELECT 
        'payment' as type,
        CONCAT('Payment completed: $', FORMAT(amount, 2)) as description,
        payment_date as created_at
      FROM payments 
      WHERE status = 'completed'
      AND payment_date IS NOT NULL
      ORDER BY payment_date DESC 
      LIMIT 3
    `);
    console.log('Recent payments found:', payments.length);
    
    // Get recent injuries
    const [injuries] = await connection.execute(`
      SELECT 
        'injury' as type,
        CONCAT('Injury reported: ', type_of_injury, ' (', injury_severity, ')') as description,
        createdAt as created_at
      FROM injuries 
      WHERE createdAt IS NOT NULL
      AND createdAt != '0000-00-00 00:00:00'
      ORDER BY createdAt DESC 
      LIMIT 2
    `);
    console.log('Recent injuries found:', injuries.length);
    
    // Get recent ratings
    const [ratings] = await connection.execute(`
      SELECT 
        'rating' as type,
        CONCAT('New ', rating, '-star rating submitted') as description,
        created_at
      FROM ratings 
      WHERE created_at IS NOT NULL
      AND created_at != '0000-00-00 00:00:00'
      ORDER BY created_at DESC 
      LIMIT 2
    `);
    console.log('Recent ratings found:', ratings.length);
    
    // Combine and sort activities
    const allActivities = [
      ...users,
      ...payments,
      ...injuries,
      ...ratings
    ].filter(activity => activity.created_at)
     .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
     .slice(0, 8);
    
    console.log('Total recent activities found:', allActivities.length);
    
    if (allActivities.length > 0) {
      console.log('Sample activities:', allActivities.slice(0, 3));
    }
    
    res.json({
      success: true,
      data: allActivities
    });
    
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent activities',
      error: error.message
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

module.exports = router;