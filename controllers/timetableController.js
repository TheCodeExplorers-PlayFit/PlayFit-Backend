const pool = require('../config/db');

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

// Fetch future booked sessions for a player
exports.getPlayerTimetable = async (req, res) => {
  try {
    const { playerId } = req.params;
    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: 'playerId is required'
      });
    }

    // Current date and time (adjustable for testing, set to May 3, 2025, 21:01)
    const now = new Date('2025-05-03T21:01:00');
    const currentDate = now.toISOString().split('T')[0]; // e.g., '2025-05-03'
    const currentTime = now.toTimeString().split(' ')[0]; // e.g., '21:01:00'

    const sessions = await executeQuery(
      `SELECT 
         pb.id AS booking_id,
         pb.booking_date AS session_date,
         pb.is_private,
         s.start_time,
         s.end_time,
         s.day_of_week,
         sp.name AS sport_name,
         st.name AS stadium_name,
         st.google_maps_link,
         l.location_name
       FROM player_bookings pb
       JOIN sessions s ON pb.session_id = s.id
       JOIN sports sp ON s.sport_id = sp.id
       JOIN stadiums st ON s.stadium_id = st.id
       JOIN locations l ON st.location_id = l.location_id
       WHERE pb.player_id = ?
         AND (
           pb.booking_date > ? 
           OR (pb.booking_date = ? AND s.start_time > ?)
         )
       ORDER BY pb.booking_date ASC, s.start_time ASC`,
      [playerId, currentDate, currentDate, currentTime]
    );

    res.status(200).json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('Error fetching player timetable:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch timetable',
      error: error.message
    });
  }
};

module.exports = {
  getPlayerTimetable: exports.getPlayerTimetable
};