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

// Fetch fully booked sessions for a stadium
exports.getFullyBookedSessions = async (req, res) => {
  try {
    const { stadiumId, playerId } = req.query;
    if (!stadiumId || !playerId) {
      return res.status(400).json({
        success: false,
        message: 'stadiumId and playerId are required'
      });
    }

    // Use tomorrow's date as start of the week
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    const query = `
      SELECT 
        s.id, 
        s.stadium_id, 
        s.sport_id, 
        sp.name AS sport_name, 
        s.coach_id, 
        CONCAT(u.first_name, ' ', u.last_name) AS coach_name,
        s.day_of_week,
        CASE s.day_of_week
          WHEN 1 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL ${tomorrow.getDay() === 1 ? 0 : 7 - tomorrow.getDay() + 1} DAY), '%Y/%m/%d')
          WHEN 2 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL ${tomorrow.getDay() === 2 ? 0 : 7 - tomorrow.getDay() + 2} DAY), '%Y/%m/%d')
          WHEN 3 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL ${tomorrow.getDay() === 3 ? 0 : 7 - tomorrow.getDay() + 3} DAY), '%Y/%m/%d')
          WHEN 4 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL ${tomorrow.getDay() === 4 ? 0 : 7 - tomorrow.getDay() + 4} DAY), '%Y/%m/%d')
          WHEN 5 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL ${tomorrow.getDay() === 5 ? 0 : 7 - tomorrow.getDay() + 5} DAY), '%Y/%m/%d')
          WHEN 6 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL ${tomorrow.getDay() === 6 ? 0 : 7 - tomorrow.getDay() + 6} DAY), '%Y/%m/%d')
          WHEN 7 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL ${tomorrow.getDay() === 0 ? 0 : 7 - tomorrow.getDay()} DAY), '%Y/%m/%d')
        END AS session_date,
        CASE s.day_of_week
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
          WHEN 7 THEN 'Sunday'
        END AS day_name,
        s.start_time, 
        s.end_time, 
        s.status, 
        s.total_cost,
        s.no_of_players, 
        s.max_players,
        w.status AS waitlist_status
      FROM sessions s
      JOIN sports sp ON s.sport_id = sp.id
      LEFT JOIN users u ON s.coach_id = u.id
      LEFT JOIN waitlist w ON s.id = w.session_id AND w.player_id = ?
      WHERE s.stadium_id = ? 
      AND s.no_of_players >= s.max_players
      AND s.recurring = 1
      AND (
        CASE s.day_of_week
          WHEN 1 THEN DATE_ADD(?, INTERVAL ${tomorrow.getDay() === 1 ? 0 : 7 - tomorrow.getDay() + 1} DAY)
          WHEN 2 THEN DATE_ADD(?, INTERVAL ${tomorrow.getDay() === 2 ? 0 : 7 - tomorrow.getDay() + 2} DAY)
          WHEN 3 THEN DATE_ADD(?, INTERVAL ${tomorrow.getDay() === 3 ? 0 : 7 - tomorrow.getDay() + 3} DAY)
          WHEN 4 THEN DATE_ADD(?, INTERVAL ${tomorrow.getDay() === 4 ? 0 : 7 - tomorrow.getDay() + 4} DAY)
          WHEN 5 THEN DATE_ADD(?, INTERVAL ${tomorrow.getDay() === 5 ? 0 : 7 - tomorrow.getDay() + 5} DAY)
          WHEN 6 THEN DATE_ADD(?, INTERVAL ${tomorrow.getDay() === 6 ? 0 : 7 - tomorrow.getDay() + 6} DAY)
          WHEN 7 THEN DATE_ADD(?, INTERVAL ${tomorrow.getDay() === 0 ? 0 : 7 - tomorrow.getDay()} DAY)
        END >= ?
      )
      ORDER BY session_date, s.start_time`;

    const params = [
      tomorrowDate, tomorrowDate, tomorrowDate, tomorrowDate, tomorrowDate, tomorrowDate, tomorrowDate,
      playerId,
      stadiumId,
      tomorrowDate, tomorrowDate, tomorrowDate, tomorrowDate, tomorrowDate, tomorrowDate, tomorrowDate,
      tomorrowDate
    ];

    const sessions = await executeQuery(query, params);

    res.status(200).json({
      success: true,
      fullyBookedSessions: sessions
    });
  } catch (error) {
    console.error('Error fetching fully booked sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fully booked sessions',
      error: error.message
    });
  }
};

// Add player to waitlist for a session
exports.addToWaitlist = async (req, res) => {
  try {
    const { playerId, sessionId } = req.body;
    if (!playerId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'playerId and sessionId are required'
      });
    }

    // Verify session is fully booked
    const [session] = await executeQuery(
      `SELECT no_of_players, max_players
       FROM sessions
       WHERE id = ?`,
      [sessionId]
    );
    if (!session || session.no_of_players < session.max_players) {
      return res.status(400).json({
        success: false,
        message: 'Session is not fully booked or does not exist'
      });
    }

    // Check if player is already on waitlist
    const existingWaitlist = await executeQuery(
      `SELECT id FROM waitlist 
       WHERE player_id = ? AND session_id = ?`,
      [playerId, sessionId]
    );
    if (existingWaitlist.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You are already on the waitlist for this session'
      });
    }

    // Add to waitlist
    const result = await executeQuery(
      `INSERT INTO waitlist (player_id, session_id, status)
       VALUES (?, ?, 'pending')`,
      [playerId, sessionId]
    );

    res.status(201).json({
      success: true,
      waitlistId: result.insertId,
      message: 'Added to waitlist successfully'
    });
  } catch (error) {
    console.error('Error adding to waitlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add to waitlist',
      error: error.message
    });
  }
};

module.exports = {
  getFullyBookedSessions: exports.getFullyBookedSessions,
  addToWaitlist: exports.addToWaitlist
};