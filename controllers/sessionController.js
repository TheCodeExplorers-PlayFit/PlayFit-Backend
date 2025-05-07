const pool = require('../config/db');
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

// Fetch all locations
exports.getLocations = async (req, res) => {
  try {
    const locations = await executeQuery('SELECT location_id, location_name FROM locations');
    res.status(200).json({ success: true, locations });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch locations', error: error.message });
  }
};

// Fetch stadiums by location and sport
exports.getStadiumsByLocationAndSport = async (req, res) => {
  try {
    const { locationId, sportId } = req.query;
    if (!locationId || !sportId) {
      return res.status(400).json({ success: false, message: 'locationId and sportId are required' });
    }
    const stadiums = await executeQuery(
      `SELECT s.id, s.name, s.address
       FROM stadiums s
       JOIN stadium_sports ss ON s.id = ss.stadium_id
       WHERE s.location_id = ? AND ss.sport_id = ?`,
      [locationId, sportId]
    );
    res.status(200).json({ success: true, stadiums });
  } catch (error) {
    console.error('Error fetching stadiums:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stadiums', error: error.message });
  }
};

// Fetch stadiums by location only
exports.getStadiumsByLocation = async (req, res) => {
  try {
    const { locationId } = req.query;
    if (!locationId) {
      return res.status(400).json({ success: false, message: 'locationId is required' });
    }
    const stadiums = await executeQuery(
      `SELECT id, name, address FROM stadiums WHERE location_id = ?`,
      [locationId]
    );
    res.status(200).json({ success: true, stadiums });
  } catch (error) {
    console.error('Error fetching stadiums by location:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stadiums', error: error.message });
  }
};

// Fetch weekly timetable for a stadium (next week's recurring sessions)
exports.getWeeklyTimetable = async (req, res) => {
  try {
    const { stadiumId, playerId } = req.query;
    if (!stadiumId) {
      return res.status(400).json({ success: false, message: 'stadiumId is required' });
    }

    const today = new Date();
    const currentDay = today.getDay();
    const daysToNextMonday = currentDay === 0 ? 1 : 8 - currentDay;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysToNextMonday);
    nextMonday.setHours(0, 0, 0, 0);

    let query = `
      SELECT 
        s.id, s.stadium_id, s.sport_id, sp.name AS sport_name, s.coach_id,
        CONCAT(u.first_name, ' ', u.last_name) AS coach_name,
        s.day_of_week,
        CASE s.day_of_week
          WHEN 1 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 0 DAY), '%Y/%m/%d')
          WHEN 2 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 1 DAY), '%Y/%m/%d')
          WHEN 3 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 2 DAY), '%Y/%m/%d')
          WHEN 4 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 3 DAY), '%Y/%m/%d')
          WHEN 5 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 4 DAY), '%Y/%m/%d')
          WHEN 6 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 5 DAY), '%Y/%m/%d')
          WHEN 7 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 6 DAY), '%Y/%m/%d')
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
        s.start_time, s.end_time, s.status, s.total_cost,
        s.no_of_players, s.max_players
      FROM sessions s
      JOIN sports sp ON s.sport_id = sp.id
      LEFT JOIN users u ON s.coach_id = u.id
      WHERE s.stadium_id = ?
      AND s.status = 'available'
      AND s.no_of_players < s.max_players
      AND s.recurring = 1`;

    const params = [nextMonday, nextMonday, nextMonday, nextMonday, nextMonday, nextMonday, nextMonday, stadiumId];

    if (playerId) {
      query += `
        AND s.id NOT IN (
          SELECT session_id FROM player_bookings
          WHERE player_id = ? AND booking_date = (
            CASE s.day_of_week
              WHEN 1 THEN DATE_ADD(?, INTERVAL 0 DAY)
              WHEN 2 THEN DATE_ADD(?, INTERVAL 1 DAY)
              WHEN 3 THEN DATE_ADD(?, INTERVAL 2 DAY)
              WHEN 4 THEN DATE_ADD(?, INTERVAL 3 DAY)
              WHEN 5 THEN DATE_ADD(?, INTERVAL 4 DAY)
              WHEN 6 THEN DATE_ADD(?, INTERVAL 5 DAY)
              WHEN 7 THEN DATE_ADD(?, INTERVAL 6 DAY)
            END
          )
        )`;
      params.push(playerId, nextMonday, nextMonday, nextMonday, nextMonday, nextMonday, nextMonday, nextMonday);
    }

    query += ` ORDER BY s.day_of_week, s.start_time`;

    const sessions = await executeQuery(query, params);
    res.status(200).json({ success: true, sessions });
  } catch (error) {
    console.error('Error fetching weekly timetable:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch weekly timetable', error: error.message });
  }
};

// Validate session availability, cost, and player capacity
exports.validateSession = async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required' });
    }
    const sessions = await executeQuery(
      `SELECT id, total_cost, status, no_of_players, max_players
       FROM sessions
       WHERE id = ? AND status = 'available'`,
      [sessionId]
    );
    if (sessions.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found or unavailable' });
    }
    const session = sessions[0];
    if (session.no_of_players >= session.max_players) {
      return res.status(400).json({ success: false, message: 'This session is fully booked' });
    }
    res.status(200).json({ success: true, session });
  } catch (error) {
    console.error('Error validating session:', error);
    res.status(500).json({ success: false, message: 'Failed to validate session', error: error.message });
  }
};
