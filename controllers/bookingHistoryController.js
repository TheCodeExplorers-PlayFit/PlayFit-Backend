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

// Fetch all bookings for a player
exports.getPlayerBookings = async (req, res) => {
  try {
    const { playerId } = req.params;
    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: 'playerId is required'
      });
    }

    const bookings = await executeQuery(
      `SELECT 
         pb.id AS booking_id,
         pb.booking_date AS session_date,
         pb.is_private,
         s.start_time,
         s.end_time,
         s.day_of_week,
         sp.name AS sport_name,
         st.name AS stadium_name,
         l.location_name
       FROM player_bookings pb
       JOIN sessions s ON pb.session_id = s.id
       JOIN sports sp ON s.sport_id = sp.id
       JOIN stadiums st ON s.stadium_id = st.id
       JOIN locations l ON st.location_id = l.location_id
       WHERE pb.player_id = ?
       ORDER BY pb.booking_date DESC`,
      [playerId]
    );

    res.status(200).json({
      success: true,
      bookings
    });
  } catch (error) {
    console.error('Error fetching player bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
};

module.exports = {
  getPlayerBookings: exports.getPlayerBookings
};