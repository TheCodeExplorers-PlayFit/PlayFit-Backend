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

// Fetch all locations
exports.getLocations = async (req, res) => {
  try {
    const locations = await executeQuery('SELECT location_id, location_name FROM locations');
    res.status(200).json({
      success: true,
      locations
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch locations',
      error: error.message
    });
  }
};

// Fetch stadiums by location and sport
exports.getStadiumsByLocationAndSport = async (req, res) => {
  try {
    const { locationId, sportId } = req.query;
    if (!locationId || !sportId) {
      return res.status(400).json({
        success: false,
        message: 'locationId and sportId are required'
      });
    }
    const stadiums = await executeQuery(
      `SELECT s.id, s.name, s.address
       FROM stadiums s
       JOIN stadium_sports ss ON s.id = ss.stadium_id
       WHERE s.location_id = ? AND ss.sport_id = ?`,
      [locationId, sportId]
    );
    res.status(200).json({
      success: true,
      stadiums
    });
  } catch (error) {
    console.error('Error fetching stadiums:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stadiums',
      error: error.message
    });
  }
};

// Fetch stadiums by location only
exports.getStadiumsByLocation = async (req, res) => {
  try {
    const { locationId } = req.query;
    if (!locationId) {
      return res.status(400).json({
        success: false,
        message: 'locationId is required'
      });
    }
    const stadiums = await executeQuery(
      `SELECT id, name, address
       FROM stadiums
       WHERE location_id = ?`,
      [locationId]
    );
    res.status(200).json({
      success: true,
      stadiums
    });
  } catch (error) {
    console.error('Error fetching stadiums by location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stadiums',
      error: error.message
    });
  }
};

// Fetch weekly timetable for a stadium
exports.getWeeklyTimetable = async (req, res) => {
  try {
    const { stadiumId, startDate } = req.query;
    if (!stadiumId) {
      return res.status(400).json({
        success: false,
        message: 'stadiumId is required'
      });
    }

    // If no startDate provided, use current week's Monday
    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);
    if (!startDate) {
      const day = start.getDay();
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1)); // Set to Monday
    }

    // Calculate end of week (Sunday)
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const sessions = await executeQuery(
      `SELECT s.id, s.stadium_id, s.sport_id, sp.name AS sport_name, s.coach_id, s.session_date, s.start_time, s.end_time, s.status
       FROM sessions s
       JOIN sports sp ON s.sport_id = sp.id
       WHERE s.stadium_id = ? AND s.session_date BETWEEN ? AND ?
       ORDER BY s.session_date, s.start_time`,
      [stadiumId, start.toISOString().split('T')[0], end.toISOString().split('T')[0]]
    );

    res.status(200).json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('Error fetching weekly timetable:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly timetable',
      error: error.message
    });
  }
};

module.exports = {
  getLocations: exports.getLocations,
  getStadiumsByLocationAndSport: exports.getStadiumsByLocationAndSport,
  getStadiumsByLocation: exports.getStadiumsByLocation,
  getWeeklyTimetable: exports.getWeeklyTimetable
};