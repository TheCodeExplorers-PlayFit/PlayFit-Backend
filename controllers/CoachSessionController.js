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
       INNER JOIN stadium_sports ss ON s.stadium_id = ss.stadium_id AND s.sport_id = ss.sport_id
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

    if (currentWeekSessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No unassigned sessions available for this stadium with valid sport configurations.'
      });
    }

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

// Update coach cost for a session
exports.updateCoachCost = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { coachCost } = req.body;

    if (!sessionId || coachCost === undefined || coachCost < 0) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and a valid coach cost are required'
      });
    }

    const [session] = await executeQuery(
      `SELECT * FROM sessions WHERE id = ? AND isbooked = 0`,
      [sessionId]
    );

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or already booked'
      });
    }

    // Check if a row exists in stadium_sports for this stadium_id and sport_id
    const countResult = await executeQuery(
      `SELECT COUNT(*) as count FROM stadium_sports WHERE stadium_id = ? AND sport_id = ?`,
      [session.stadium_id, session.sport_id]
    );

    // Log the result for debugging
    console.log('Count result:', countResult);

    // Ensure countResult is an array and has at least one row
    if (!Array.isArray(countResult) || countResult.length === 0 || !countResult[0] || typeof countResult[0].count !== 'number') {
      return res.status(500).json({
        success: false,
        message: 'Failed to verify stadium-sport configuration.'
      });
    }

    const rowCount = countResult[0].count;

    if (rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update coach cost. The stadium does not support this sport.'
      });
    }

    await executeQuery(
      `UPDATE sessions SET coach_cost = ? WHERE id = ?`,
      [coachCost, sessionId]
    );

    res.status(200).json({
      success: true,
      message: 'Coach cost updated successfully'
    });
  } catch (error) {
    console.error('Error updating coach cost:', error);
    if (error.code === 'ER_SIGNAL_EXCEPTION' && error.sqlMessage === 'No sport_percentage found for given stadium_id and sport_id') {
      res.status(400).json({
        success: false,
        message: 'Cannot update coach cost. The stadium does not support this sport.'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update coach cost',
        error: error.message
      });
    }
  }
};

// Book a session (set isbooked to 1, update coach_id and status)
exports.bookSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { coachId } = req.body; // Get coachId from the request body

    if (!sessionId || !coachId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and Coach ID are required'
      });
    }

    const [session] = await executeQuery(
      `SELECT * FROM sessions WHERE id = ? AND isbooked = 0`,
      [sessionId]
    );

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or already booked'
      });
    }

    await executeQuery(
      `UPDATE sessions SET isbooked = 1, coach_id = ?, status = 'booked' WHERE id = ?`,
      [coachId, sessionId]
    );

    res.status(200).json({
      success: true,
      message: 'Session booked successfully'
    });
  } catch (error) {
    console.error('Error booking session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to book session',
      error: error.message
    });
  }
};

// Export the controller functions
module.exports = {
  getWeeklyTimetable: exports.getWeeklyTimetable,
  updateCoachCost: exports.updateCoachCost,
  bookSession: exports.bookSession
};
