const mysql = require('mysql2/promise');
const { pool } = require('../config/db');
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


async function getSessionDetails(req, res) {
  try {
    const coachId = parseInt(req.params.coachId);
    if (!coachId) {
      return res.status(400).json({
        success: false,
        message: 'Coach ID is required'
      });
    }

    const sessions = await executeQuery(`
      SELECT s.id, s.start_time, s.end_time, s.no_of_players, DATE(pb.booking_date) as session_date
      FROM sessions s
      LEFT JOIN player_bookings pb ON s.id = pb.session_id
      WHERE s.coach_id = ? AND s.isbooked = 1 AND s.status = 'booked'
      GROUP BY s.id
    `, [coachId]);

    const sessionDetails = await Promise.all(sessions.map(async (session) => {
      const bookings = await executeQuery(`
        SELECT u.first_name, u.last_name
        FROM player_bookings pb
        JOIN users u ON pb.player_id = u.id
        WHERE pb.session_id = ?
      `, [session.id]);

      return {
        sessionId: session.id,
        startTime: session.start_time.slice(0, 5),
        endTime: session.end_time.slice(0, 5),
        date: session.session_date ? session.session_date.toISOString().split('T')[0] : '2025-07-12',
        playerCount: session.no_of_players || 0,
        players: bookings.length ? bookings.map(b => `${b.first_name} ${b.last_name}`) : ['None']
      };
    }));

    if (sessionDetails.length === 0) {
      return res.status(200).json({
        success: true,
        sessions: [],
        message: 'No booked sessions found for this coach'
      });
    }

    res.status(200).json({
      success: true,
      sessions: sessionDetails
    });
  } catch (error) {
    console.error('Error fetching session details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch session details',
      error: error.message
    });
  }
}


// Fetch weekly timetable for a stadium
async function getWeeklyTimetable(req, res) {
  try {
    const { stadiumId, startDate, endDate } = req.query;
    if (!stadiumId) {
      return res.status(400).json({
        success: false,
        message: 'stadiumId is required'
      });
    }

    const today = new Date(); 
    today.setHours(0, 0, 0, 0);
    const start = startDate ? new Date(startDate) : new Date(today);
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date(today);
    end.setDate(today.getDate() + 7); 
    end.setHours(23, 59, 59, 999);

    const sessions = await executeQuery(
      `SELECT DISTINCT s.id, s.stadium_id, s.sport_id, sp.name AS sport_name, s.coach_id, s.start_time, s.end_time, s.status, s.total_cost AS cost, s.day_of_week, s.recurring, s.isbooked, s.max_players, s.no_of_players, s.stadium_sport_cost, s.coach_cost
       FROM sessions s
       JOIN sports sp ON s.sport_id = sp.id
       INNER JOIN (
         SELECT DISTINCT stadium_id, sport_id
         FROM stadium_sports
       ) ss ON s.stadium_id = ss.stadium_id AND s.sport_id = ss.sport_id
       WHERE s.stadium_id = ? AND s.isbooked = 0 AND s.recurring = 1`,
      [stadiumId]
    );

    const currentWeekSessions = sessions.map(session => {
      const sessionDate = new Date(start);
      const currentDayOfWeek = start.getDay() === 0 ? 7 : start.getDay(); 
      const dayAdjustment = (session.day_of_week - currentDayOfWeek + 7) % 7; 
      sessionDate.setDate(start.getDate() + dayAdjustment);
      return {
        ...session,
        session_date: sessionDate.toISOString().split('T')[0]
      };
    }).filter(session => {
      const sessionDate = new Date(session.session_date);
      return sessionDate >= start && sessionDate <= end;
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
}

// Update coach cost for a session
async function updateCoachCost(req, res) {
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
}

// Book a session
async function bookSession(req, res) {
  try {
    const { sessionId } = req.params;
    const { coachId } = req.body;

    console.log(`Booking session: sessionId=${sessionId}, coachId=${coachId}`);

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

    const [coach] = await executeQuery(
      `SELECT id FROM users WHERE id = ?`, 
      [coachId]
    );

    if (!coach) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Coach ID: Coach does not exist'
      });
    }

    const result = await executeQuery(
      `UPDATE sessions SET coach_id = ?, isbooked = 1, status = 'booked' WHERE id = ? AND isbooked = 0`,
      [coachId, sessionId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: 'Session already booked or update failed'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Session booked successfully'
    });
  } catch (error) {
    console.error('Error booking session:', error);
    let message = 'Failed to book session';
    if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_ROW_IS_REFERENCED_2') {
      message = 'Invalid Coach ID: Coach does not exist in the database';
    }
    res.status(500).json({
      success: false,
      message,
      error: error.message
    });
  }
}

// Fetch booking history for a coach
async function getBookingHistory(req, res) {
  try {
    console.log('Received request for booking history, req.headers:', req.headers);
    console.log('Received request for booking history, req.user:', req.user);

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

    const coachId = req.params.coachId || req.user?.id; 
    console.log('Extracted coachId:', coachId);

    if (!coachId) {
      return res.status(400).json({
        success: false,
        message: 'Coach ID is required. Please ensure you are logged in.'
      });
    }

    console.log(`Fetching booking history for coachId: ${coachId}`);

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

    const today = new Date();
    const todayDayOfWeek = today.getDay() || 7; // Sunday = 0
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (todayDayOfWeek - 1));

    const formattedBookings = bookings.map(booking => {
      const sessionDate = new Date(startOfWeek);
      const dayAdjustment = (booking.day_of_week - 1);
      sessionDate.setDate(startOfWeek.getDate() + dayAdjustment);

      const formattedDate = sessionDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).split('/').join('/');

      return {
        id: booking.id,
        clubName: booking.clubName,
        date: formattedDate,
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
}

// Fetch total salary and coach name for the logged-in coach
async function getCoachSalaries(req, res) {
  try {
    console.log('req.user:', req.user);

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let decodedToken = null;
    if (token) {
      try {
        decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Manually decoded token:', decodedToken);
      } catch (error) {
        console.log('Failed to manually decode token:', error.message);
      }
    } else {
      console.log('No Authorization header or token found');
    }

    const coachId = req.user?.id || decodedToken?.id;
    console.log('Coach ID from req.user.id or decoded token:', coachId);

    if (!coachId) {
      console.log('No coachId found in req.user or token');
      return res.status(400).json({
        success: false,
        message: 'Coach ID is required. Please ensure you are logged in.'
      });
    }

    const coachIdInt = parseInt(coachId, 10);
    if (isNaN(coachIdInt)) {
      console.log('Invalid coachId format:', coachId);
      return res.status(400).json({
        success: false,
        message: 'Invalid Coach ID format.'
      });
    }

    const salaryData = await executeQuery(`
      SELECT coach_id, SUM(coach_cost * no_of_players) AS total_salary
      FROM sessions
      WHERE coach_id = ?
      GROUP BY coach_id
    `, [coachIdInt]);

    console.log('Salary query result:', salaryData);

    if (!salaryData || salaryData.length === 0) {
      console.log('No salary data found for coach_id:', coachIdInt);
      return res.status(200).json([]);
    }

    const userData = await executeQuery(`
      SELECT id, CONCAT(first_name, ' ', COALESCE(last_name, '')) AS coach_name
      FROM users
      WHERE id = ?
    `, [coachIdInt]);

    console.log('User query result:', userData);

    if (!userData || userData.length === 0) {
      console.log('No user data found for coach_id:', coachIdInt);
      return res.status(404).json({
        success: false,
        message: 'User not found for the given Coach ID.'
      });
    }

    const response = [{
      coach_id: salaryData[0].coach_id,
      total_salary: parseFloat(salaryData[0].total_salary),
      coach_name: userData[0].coach_name || 'Name not available'
    }];

    console.log('Final response sent to frontend:', response);

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching coach salaries:', error.message, error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coach salaries',
      error: error.message
    });
  }
}

// Submit a complaint as a coach
async function submitCoachComplaint(req, res) {
  try {
    const { type, stadium_id, description } = req.body;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    let decoded = null;
    if (token) {
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
      }
    }

    const userId = decoded?.id || req.user?.id;
    if (!userId || !type || !description?.trim()) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Prepare values for insertion
    const reported_by = userId; // Coach's user ID
    const reported_to = type === 'stadium' ? 'stadiumOwner' : 'admin';
    const stadiumId = type === 'stadium' ? stadium_id : null;
    const coachId = null; // Always null for coach complaints

    const insertQuery = `
      INSERT INTO reports 
        (reported_by, reported_to, stadium_id, coach_id, description, status) 
      VALUES (?, ?, ?, ?, ?, 'pending')
    `;

    await executeQuery(insertQuery, [
      reported_by,
      reported_to,
      stadiumId,
      coachId,
      description
    ]);

    return res.status(201).json({ success: true, message: 'Coach complaint submitted successfully' });
  } catch (error) {
    console.error('Error submitting coach complaint:', error);
    return res.status(500).json({ success: false, message: 'Server error submitting complaint' });
  }
}

// Fetch stadiums
async function getStadiums(req, res) {
  try {
    // Example query: fetch stadiums relevant to coach sessions
    const stadiums = await executeQuery(`
      SELECT s.id, s.name, s.address, s.images
      FROM stadiums s
      WHERE s.isVerified = 1
    `);

    res.status(200).json({ success: true, data: stadiums });
  } catch (error) {
    console.error('Error fetching stadiums:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stadiums' });
  }
}

async function getApprovedBlogs(req, res) {
  try {
    // SQL joining blogs with users to get author info
    const query = `
      SELECT 
        b.id, b.title, b.content, b.status, b.created_at, b.image,
        u.first_name, u.last_name, u.role
      FROM blogs b
      JOIN users u ON b.user_id = u.id
      WHERE b.status = 'approved'
      ORDER BY b.created_at DESC
    `;

    const blogs = await executeQuery(query);

    return res.json(blogs);
  } catch (error) {
    console.error('Error fetching blogs:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch blogs' });
  }
}

async function getWeeklySalaryOverview(req, res) {
  try {
    const coachId = req.user.id;

    const queryResult = await executeQuery(
      `SELECT
         CASE day_of_week
           WHEN 1 THEN 'Monday'
           WHEN 2 THEN 'Tuesday'
           WHEN 3 THEN 'Wednesday'
           WHEN 4 THEN 'Thursday'
           WHEN 5 THEN 'Friday'
           WHEN 6 THEN 'Saturday'
           WHEN 7 THEN 'Sunday'
         END AS day,
         SUM(coach_cost * COALESCE(no_of_players, 0)) AS salary
       FROM sessions
       WHERE coach_id = ?
         AND isbooked = 1
         AND coach_cost IS NOT NULL
       GROUP BY day_of_week
       ORDER BY day_of_week`,
      [coachId]
    );

    // Fill in missing weekdays with 0 salary
    const fullWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const padded = fullWeek.map(day => {
      const match = queryResult.find(d => d.day === day);
      return { day, salary: match ? match.salary : 0 };
    });

    res.status(200).json(padded);
  } catch (error) {
    console.error('Weekly salary error:', error);
    res.status(500).json({ message: 'Failed to fetch salary overview' });
  }
}



// Get Monthly Sessions Overview (for logged-in coach)
async function getSessionsOverview(req, res) {
  try {
    const coachId = req.user.id;

    const results = await executeQuery(`
      SELECT 
        MONTHNAME(pb.booking_date) AS month, 
        COUNT(*) AS sessionsCount
      FROM player_bookings pb
      JOIN sessions s ON pb.session_id = s.id
      WHERE s.coach_id = ?
      GROUP BY MONTH(pb.booking_date)
      ORDER BY MONTH(pb.booking_date)
    `, [coachId]);

    res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching sessions overview:', error);
    res.status(500).json({ message: 'Failed to fetch sessions overview' });
  }
}
// Get all notices
async function getAllNotices(req, res) {
  try {
    const [notices] = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC');
    res.json(notices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notices' });
  }
}


// Get notices for coaches
async function getCoachNotices(req, res) {
  try {
    const [notices] = await pool.query(
      "SELECT * FROM announcements WHERE category = 'about coaches' ORDER BY created_at DESC"
    );
    res.json(notices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch coach notices' });
  }
}


// Helper to execute queries
async function executeQuery(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

// Get recent stadium ratings (limit optional)
async function getRecentStadiumRatings(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const sql = `
      SELECT r.*, u.first_name, u.last_name, s.name AS stadium_name
      FROM ratings r
      JOIN users u ON r.user_id = u.id
      JOIN stadiums s ON r.entity_id = s.id
      WHERE r.entity_type = 'stadium'
      ORDER BY r.created_at DESC
      LIMIT ?`;
    const data = await executeQuery(sql, [limit]);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching stadium ratings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stadium ratings' });
  }
}

// Search stadiums by name (limit 10)
async function searchStadiums(req, res) {
  try {
    const query = req.query.query || '';
    if (!query.trim()) {
      return res.status(400).json({ success: false, message: 'Query parameter is required' });
    }

    const sql = `SELECT id, name FROM stadiums WHERE name LIKE ? LIMIT 10`;
    const data = await executeQuery(sql, [`%${query}%`]);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error searching stadiums:', error);
    res.status(500).json({ success: false, message: 'Failed to search stadiums' });
  }
}

// Add a new stadium rating
async function addStadiumRating(req, res) {
  try {
    const userId = req.user?.id;
    const { entity_id, rating, comment } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (!entity_id || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Invalid rating or entity_id' });
    }

    const sql = `
      INSERT INTO ratings (user_id, entity_type, entity_id, rating, comment, created_at)
      VALUES (?, 'stadium', ?, ?, ?, NOW())`;

    await executeQuery(sql, [userId, entity_id, rating, comment || null]);
    res.status(201).json({ success: true, message: 'Stadium rating submitted' });
  } catch (error) {
    console.error('Error adding stadium rating:', error);
    res.status(500).json({ success: false, message: 'Failed to add rating' });
  }
}




// Export the controller functions
module.exports = {
  getSessionDetails,
  getWeeklyTimetable,
  updateCoachCost,
  bookSession,
  getBookingHistory,
  getCoachSalaries,
  submitCoachComplaint,
  getStadiums,
  getApprovedBlogs,
  getWeeklySalaryOverview,
  getSessionsOverview,
   getAllNotices,
  getCoachNotices,
  getRecentStadiumRatings,
  searchStadiums,
  addStadiumRating
};