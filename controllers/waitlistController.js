// waitlistController.js - Stadium Owner Only
const { pool } = require('../config/db');

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

// Helper function to execute transaction
async function executeTransaction(operations) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const results = [];
    
    for (const operation of operations) {
      const [result] = await connection.execute(operation.sql, operation.params);
      results.push(result);
    }
    
    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Fetch waitlist entries for stadium owner's stadiums
exports.getWaitlistForOwner = async (req, res) => {
  try {
    const { ownerId } = req.query;
    
    if (!ownerId) {
      return res.status(400).json({
        success: false,
        message: 'Owner ID is required'
      });
    }

    const query = `
      SELECT 
        w.id AS waitlist_id,
        w.player_id,
        CONCAT(u.first_name, ' ', u.last_name) AS player_name,
        u.email AS player_email,
        s.id AS session_id,
        s.stadium_id,
        st.name AS stadium_name,
        sp.name AS sport_name,
        TIME_FORMAT(s.start_time, '%H:%i') AS start_time,
        TIME_FORMAT(s.end_time, '%H:%i') AS end_time,
        CASE s.day_of_week
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
          WHEN 7 THEN 'Sunday'
        END AS day_name,
        w.status,
        DATE_FORMAT(w.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        s.no_of_players,
        s.max_players
      FROM waitlist w
      JOIN users u ON w.player_id = u.id
      JOIN sessions s ON w.session_id = s.id
      JOIN stadiums st ON s.stadium_id = st.id
      JOIN sports sp ON s.sport_id = sp.id
      WHERE st.owner_id = ?
      ORDER BY w.created_at DESC`;

    const waitlist = await executeQuery(query, [ownerId]);

    res.status(200).json({
      success: true,
      waitlist: waitlist,
      count: waitlist.length
    });

  } catch (error) {
    console.error('Error fetching waitlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch waitlist entries',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const db = require('../config/db');

// GET waitlist by ownerId
exports.getWaitlistByOwnerId = (req, res) => {
  const ownerId = req.query.ownerId;

  if (!ownerId) {
    return res.status(400).json({ error: 'Missing ownerId in query' });
  }

  const query = `
    SELECT 
      w.id,
      u.first_name AS player_name,
      s.name AS session_name,
      w.status,
      w.created_at
    FROM waitlist w
    JOIN users u ON w.player_id = u.id
    JOIN sessions s ON w.session_id = s.id
    JOIN stadiums st ON s.stadium_id = st.id
    WHERE st.owner_id = ?
    ORDER BY w.created_at DESC
  `;

  db.query(query, [ownerId], (err, results) => {
    if (err) {
      console.error('Error fetching waitlist:', err);
      return res.status(500).json({ error: 'Failed to fetch waitlist' });
    }

    res.status(200).json(results);
  });
};



// Update waitlist status (approve or reject)
exports.updateWaitlistStatus = async (req, res) => {
  console.log('Request body:', req.body);
  try {
    const { waitlistId, status } = req.body;

    // Validation
    if (!waitlistId || !Number.isInteger(waitlistId) || waitlistId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid waitlist ID is required'
      });
    }

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either approved or rejected'
      });
    }

    // Get waitlist entry details
    const [waitlistEntry] = await executeQuery(`
      SELECT 
        w.session_id, 
        w.player_id,
        w.status AS current_status,
        s.no_of_players,
        s.max_players,
        st.owner_id,
        CONCAT(u.first_name, ' ', u.last_name) AS player_name
      FROM waitlist w
      JOIN sessions s ON w.session_id = s.id
      JOIN stadiums st ON s.stadium_id = st.id
      JOIN users u ON w.player_id = u.id
      WHERE w.id = ?
    `, [waitlistId]);

    if (!waitlistEntry) {
      return res.status(404).json({
        success: false,
        message: 'Waitlist entry not found'
      });
    }

    // Check if already processed
    if (waitlistEntry.current_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${waitlistEntry.current_status}`
      });
    }

    // If approving, check session capacity and handle booking
    if (status === 'approved') {
      if (waitlistEntry.no_of_players >= waitlistEntry.max_players) {
        return res.status(400).json({
          success: false,
          message: 'Session is currently full. Cannot approve this request.'
        });
      }

      // Check if player is already booked for this session
      const existingBooking = await executeQuery(`
        SELECT id FROM player_bookings 
        WHERE player_id = ? AND session_id = ?
      `, [waitlistEntry.player_id, waitlistEntry.session_id]);

      if (existingBooking.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Player is already booked for this session'
        });
      }

      // Execute approval transaction
      const operations = [
        {
          sql: `INSERT INTO player_bookings (player_id, session_id, booking_date, is_private, status)
                VALUES (?, ?, CURDATE(), 0, 'confirmed')`,
          params: [waitlistEntry.player_id, waitlistEntry.session_id]
        },
        {
          sql: `UPDATE sessions SET no_of_players = no_of_players + 1 WHERE id = ?`,
          params: [waitlistEntry.session_id]
        },
        {
          sql: `UPDATE waitlist SET status = ?, updated_at = NOW() WHERE id = ?`,
          params: [status, waitlistId]
        }
      ];

      await executeTransaction(operations);

      res.status(200).json({
        success: true,
        message: `${waitlistEntry.player_name} has been approved and added to the session`
      });

    } else {
      // Handle rejection - just update status
      await executeQuery(`
        UPDATE waitlist 
        SET status = ?
        WHERE id = ?
      `, [status, waitlistId]);

      res.status(200).json({
        success: true,
        message: `Request from ${waitlistEntry.player_name} has been rejected`
      });
    }

  } catch (error) {
    console.error('Error updating waitlist status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update waitlist status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get waitlist statistics for owner dashboard
exports.getWaitlistStats = async (req, res) => {
  try {
    const { ownerId } = req.query;

    if (!ownerId) {
      return res.status(400).json({
        success: false,
        message: 'Owner ID is required'
      });
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN w.status = 'pending' THEN 1 ELSE 0 END) as pending_requests,
        SUM(CASE WHEN w.status = 'approved' THEN 1 ELSE 0 END) as approved_requests,
        SUM(CASE WHEN w.status = 'rejected' THEN 1 ELSE 0 END) as rejected_requests
      FROM waitlist w
      JOIN sessions s ON w.session_id = s.id
      JOIN stadiums st ON s.stadium_id = st.id
      WHERE st.owner_id = ?
      AND w.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `;

    const [stats] = await executeQuery(statsQuery, [ownerId]);

    res.status(200).json({
      success: true,
      stats: {
        total: parseInt(stats.total_requests) || 0,
        pending: parseInt(stats.pending_requests) || 0,
        approved: parseInt(stats.approved_requests) || 0,
        rejected: parseInt(stats.rejected_requests) || 0
      }
    });

  } catch (error) {
    console.error('Error fetching waitlist stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch waitlist statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getWaitlistForOwner: exports.getWaitlistForOwner,
  getWaitlistByOwnerId: exports.getWaitlistByOwnerId,
  updateWaitlistStatus: exports.updateWaitlistStatus,
  getWaitlistStats: exports.getWaitlistStats
};