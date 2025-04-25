const pool = require('../config/db');

async function executeQuery(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

exports.getStadiums = async (req, res) => {
  try {
    const { sports } = req.query; // e.g., sports="1,2,3" (sport IDs)
    let query = `
      SELECT DISTINCT s.id, s.owner_id, s.name, s.address, s.location_id, s.description, s.images
      FROM stadiums s
      JOIN stadium_sports ss ON s.id = ss.stadium_id
    `;
    let params = [];

    if (sports) {
      const sportIds = sports.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (sportIds.length > 0) {
        query += ` WHERE ss.sport_id IN (${sportIds.map(() => '?').join(',')})`;
        params.push(...sportIds);
      }
    }

    const stadiums = await executeQuery(query, params);
    res.status(200).json(stadiums);
  } catch (error) {
    console.error('Error fetching stadiums:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stadiums',
      error: error.message
    });
  }
};