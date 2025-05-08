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

    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);
    if (!startDate) {
      const day = start.getDay();
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    }

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const sessions = await executeQuery(
      `SELECT s.id, s.stadium_id, s.sport_id, sp.name AS sport_name, s.coach_id, s.start_time, s.end_time, s.status, s.total_cost AS cost, s.day_of_week, s.recurring, s.isbooked, s.max_players, s.no_of_players, s.stadium_sport_cost, s.coach_cost
       FROM sessions s
       JOIN sports sp ON s.sport_id = sp.id
       WHERE s.stadium_id = ? AND s.isbooked = 0`,
      [stadiumId]
    );

    const currentWeekSessions = sessions.map(session => {
      const sessionDate = new Date(start);
      const dayAdjustment = (session.day_of_week - 1) - (start.getDay() === 0 ? 6 : start.getDay() - 1);
      sessionDate.setDate(start.getDate() + dayAdjustment);
      return {
        ...session,
        session_date: sessionDate.toISOString().split('T')[0]
      };
    }).filter(session => {
      const sessionDate = new Date(session.session_date);
      return session.recurring === 1 && sessionDate >= start && sessionDate <= end;
    });

    res.status(200).json({
      success: true,
      sessions: currentWeekSessions
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

// Export the controller function
module.exports = {
  getWeeklyTimetable: exports.getWeeklyTimetable
};