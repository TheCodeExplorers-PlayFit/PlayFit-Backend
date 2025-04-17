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

module.exports = {
  getLocations: exports.getLocations,
  getStadiumsByLocationAndSport: exports.getStadiumsByLocationAndSport
};