const mysql = require('mysql2/promise');
const pool = require('../config/db');
const jwt = require('jsonwebtoken'); // For manual token decoding (debugging)

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
      `SELECT DISTINCT s.id, s.stadium_id, s.sport_id, sp.name AS sport_name, s.coach_id, s.start_time, s.end_time, s.status, s.total_cost AS cost, s.day_of_week, s.recurring, s.isbooked, s.max_players, s.no_of_players, s.stadium_sport_cost, s.coach_cost
       FROM sessions s
       JOIN sports sp ON s.sport_id = sp.id
       INNER JOIN (
         SELECT DISTINCT stadium_id, sport_id
         FROM stadium_sports
       ) ss ON s.stadium_id = ss.stadium_id AND s.sport_id = ss.sport_id
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

    console.log(`Updating coach cost for sessionId: ${sessionId}, coachCost: ${coachCost}`);

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

    console.log('Session data:', session);

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
      return res.status(400).json({
        success: false,
        message: 'Cannot update coach cost. The stadium does not support this sport.'
      });
    } else {
      return res.status(500).json({
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
    const { coachId } = req.body;

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

// Fetch booking history for a coach
exports.getBookingHistory = async (req, res) => {
  try {
    console.log('Received request for booking history, req.headers:', req.headers); // Debug log
    console.log('Received request for booking history, req.user:', req.user); // Debug log

    // Manually decode the token for debugging
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Manually decoded token:', decoded);
      } catch (error) {
        console.log('Failed to manually decode token:', error.message);
      }
    } else {
      console.log('No Authorization header or token found');
    }

    const coachId = req.user?.id; // Extract coachId from req.user set by protect middleware
    console.log('Extracted coachId:', coachId); // Debug log

    if (!coachId) {
      return res.status(400).json({
        success: false,
        message: 'Coach ID is required. Please ensure you are logged in.'
      });
    }

    console.log(`Fetching booking history for coachId: ${coachId}`); // Debug log

    const bookings = await executeQuery(
      `SELECT s.id, st.name AS clubName, s.day_of_week, s.start_time, s.end_time
       FROM sessions s
       JOIN stadiums st ON s.stadium_id = st.id
       WHERE s.coach_id = ? AND s.status = 'booked' AND s.isbooked = 1`,
      [coachId]
    );

    console.log(`Bookings for coach ${coachId}:`, bookings);

    if (bookings.length === 0) {
      return res.status(200).json({
        success: true,
        bookings: [],
        message: 'No bookings found for this coach'
      });
    }

    // Compute the session date using day_of_week
    const today = new Date('2025-05-17'); // Today is May 17, 2025 (Saturday)
    const todayDayOfWeek = today.getDay() || 7; // getDay(): 0 (Sunday) to 6 (Saturday), map to 1 (Monday) to 7 (Sunday)
    const startOfWeek = new Date(today); // Calculate Monday of the current week
    startOfWeek.setDate(today.getDate() - (todayDayOfWeek - 1)); // Adjust to Monday (day_of_week = 1)

    const formattedBookings = bookings.map(booking => {
      // Calculate the session date based on day_of_week
      const sessionDate = new Date(startOfWeek);
      const dayAdjustment = booking.day_of_week - 1; // day_of_week (1 to 7) to 0-based offset from Monday
      sessionDate.setDate(startOfWeek.getDate() + dayAdjustment);

      // Format the date as DD/MM/YYYY
      const formattedDate = sessionDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).split('/').join('/');

      return {
        id: booking.id,
        clubName: booking.clubName,
        date: formattedDate, // Use computed date
        time: `${booking.start_time.slice(0, 5)} - ${booking.end_time.slice(0, 5)}`
      };
    });

    res.status(200).json({
      success: true,
      bookings: formattedBookings
    });
  } catch (error) {
    console.error('Error fetching booking history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking history',
      error: error.message
    });
  }
};

// Fetch coach details
exports.getCoachDetails = async (req, res) => {
  try {
    console.log('Received request for coach details, req.user:', req.user); // Debug log
    const coachId = req.user?.id; // Extract coachId from req.user set by protect middleware

    if (!coachId) {
      return res.status(400).json({
        success: false,
        message: 'Coach ID is required. Please ensure you are logged in.'
      });
    }

    console.log(`Fetching details for coachId: ${coachId}`); // Debug log

    const coachData = await executeQuery(
      `SELECT u.id, u.first_name, u.last_name, u.email, cd.sport1, cd.sport2, cd.sport3, cd.experience
       FROM users u
       LEFT JOIN coach_details cd ON u.id = cd.userId
       WHERE u.id = ? AND u.role = 'coach'`,
      [coachId]
    );

    if (coachData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    const coach = coachData[0];
    res.status(200).json({
      success: true,
      coach: {
        id: coach.id,
        firstName: coach.first_name,
        lastName: coach.last_name,
        email: coach.email,
        sport1: coach.sport1,
        sport2: coach.sport2,
        sport3: coach.sport3,
        experience: coach.experience
      }
    });
  } catch (error) {
    console.error('Error fetching coach details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coach details',
      error: error.message
    });
  }
};

// Export the controller functions
module.exports = {
  getWeeklyTimetable: exports.getWeeklyTimetable,
  updateCoachCost: exports.updateCoachCost,
  bookSession: exports.bookSession,
  getBookingHistory: exports.getBookingHistory,
  getCoachDetails: exports.getCoachDetails
};