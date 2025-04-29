// controllers/stadiumController.js
const pool = require('../config/db');

// Get stadiums based on coach's sports
exports.getStadiumsByCoachSports = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is a coach
    if (req.user.role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can access this resource'
      });
    }

    // Get coach's sports
    const [coachSports] = await pool.execute(
      `SELECT sport1, sport2, sport3 FROM coach_details WHERE userId = ?`,
      [userId]
    );

    if (coachSports.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Coach details not found'
      });
    }

    // Collect all sports the coach teaches (filtering out null values)
    const sportsArray = [
      coachSports[0].sport1,
      coachSports[0].sport2,
      coachSports[0].sport3
    ].filter(sport => sport !== null);

    if (sportsArray.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No sports found for this coach'
      });
    }

    // Get stadiums that offer any of the coach's sports
    const placeholders = sportsArray.map(() => '?').join(',');
    const [stadiums] = await pool.execute(
      `SELECT DISTINCT s.id, s.name, s.description, s.images, s.address, l.location_name,
       GROUP_CONCAT(DISTINCT sp.name) as sport_names
       FROM stadiums s
       JOIN stadium_sports ss ON s.id = ss.stadium_id
       JOIN sports sp ON ss.sport_id = sp.id
       LEFT JOIN locations l ON s.location_id = l.location_id
       WHERE ss.sport_id IN (${placeholders}) AND s.isVerified = 1
       GROUP BY s.id`,
      [...sportsArray]
    );

    // Process the images JSON string for each stadium
    const processedStadiums = stadiums.map(stadium => {
      let images = [];
      try {
        images = JSON.parse(stadium.images || '[]');
      } catch (e) {
        console.error('Error parsing stadium images:', e);
      }

      return {
        ...stadium,
        images: images,
        sport_names: stadium.sport_names ? stadium.sport_names.split(',') : []
      };
    });

    res.status(200).json({
      success: true,
      data: processedStadiums
    });
  } catch (error) {
    console.error('Error fetching stadiums by coach sports:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};