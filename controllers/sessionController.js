const { pool } = require('../config/db');
const crypto = require('crypto');

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

// Fetch weekly timetable for a stadium, showing next week's sessions
exports.getWeeklyTimetable = async (req, res) => {
  try {
    const { stadiumId, playerId } = req.query;
    if (!stadiumId) {
      return res.status(400).json({
        success: false,
        message: 'stadiumId is required'
      });
    }

    // Calculate next week's Monday
    const today = new Date();
    const currentDay = today.getDay();
    const daysToNextMonday = currentDay === 0 ? 1 : 8 - currentDay;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysToNextMonday);
    nextMonday.setHours(0, 0, 0, 0);

    // Calculate session dates based on day_of_week
    let query = `
      SELECT 
        s.id, 
        s.stadium_id, 
        s.sport_id, 
        sp.name AS sport_name, 
        s.coach_id, 
        CONCAT(u.first_name, ' ', u.last_name) AS coach_name,
        s.day_of_week,
        CASE s.day_of_week
          WHEN 1 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 0 DAY), '%Y/%m/%d')
          WHEN 2 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 1 DAY), '%Y/%m/%d')
          WHEN 3 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 2 DAY), '%Y/%m/%d')
          WHEN 4 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 3 DAY), '%Y/%m/%d')
          WHEN 5 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 4 DAY), '%Y/%m/%d')
          WHEN 6 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 5 DAY), '%Y/%m/%d')
          WHEN 7 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 6 DAY), '%Y/%m/%d')
        END AS session_date,
        CASE s.day_of_week
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
          WHEN 7 THEN 'Sunday'
        END AS day_name,
        s.start_time, 
        s.end_time, 
        s.status, 
        s.total_cost,
        s.no_of_players, 
        s.max_players
      FROM sessions s
      JOIN sports sp ON s.sport_id = sp.id
      LEFT JOIN users u ON s.coach_id = u.id
      WHERE s.stadium_id = ? 
      AND s.status = 'available' 
      AND s.no_of_players < s.max_players
      AND s.recurring = 1`;
    
    const params = [
      nextMonday, nextMonday, nextMonday, nextMonday, 
      nextMonday, nextMonday, nextMonday, stadiumId
    ];

    if (playerId) {
      query += ` AND s.id NOT IN (
        SELECT session_id 
        FROM player_bookings 
        WHERE player_id = ? 
        AND booking_date = (
          CASE s.day_of_week
            WHEN 1 THEN DATE_ADD(?, INTERVAL 0 DAY)
            WHEN 2 THEN DATE_ADD(?, INTERVAL 1 DAY)
            WHEN 3 THEN DATE_ADD(?, INTERVAL 2 DAY)
            WHEN 4 THEN DATE_ADD(?, INTERVAL 3 DAY)
            WHEN 5 THEN DATE_ADD(?, INTERVAL 4 DAY)
            WHEN 6 THEN DATE_ADD(?, INTERVAL 5 DAY)
            WHEN 7 THEN DATE_ADD(?, INTERVAL 6 DAY)
          END
        )
      )`;
      params.push(playerId, nextMonday, nextMonday, nextMonday, nextMonday, nextMonday, nextMonday, nextMonday);
    }

    query += ` ORDER BY s.day_of_week, s.start_time`;

    const sessions = await executeQuery(query, params);

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

// Validate session availability, cost, and player capacity
exports.validateSession = async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'sessionId is required'
      });
    }
    const sessions = await executeQuery(
      `SELECT id, total_cost, status, no_of_players, max_players
       FROM sessions
       WHERE id = ? AND status = 'available'`,
      [sessionId]
    );
    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or unavailable'
      });
    }
    const session = sessions[0];
    if (session.no_of_players >= session.max_players) {
      return res.status(400).json({
        success: false,
        message: 'This session is fully booked'
      });
    }
    res.status(200).json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Error validating session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate session',
      error: error.message
    });
  }
};

// Fetch booking details for popup
exports.getBookingDetails = async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'sessionId is required'
      });
    }
    // Calculate next week's Monday for session_date
    const today = new Date();
    const currentDay = today.getDay();
    const daysToNextMonday = currentDay === 0 ? 1 : 8 - currentDay;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysToNextMonday);

    const details = await executeQuery(
      `SELECT 
         CASE s.day_of_week
           WHEN 1 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 0 DAY), '%Y/%m/%d')
           WHEN 2 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 1 DAY), '%Y/%m/%d')
           WHEN 3 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 2 DAY), '%Y/%m/%d')
           WHEN 4 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 3 DAY), '%Y/%m/%d')
           WHEN 5 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 4 DAY), '%Y/%m/%d')
           WHEN 6 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 5 DAY), '%Y/%m/%d')
           WHEN 7 THEN DATE_FORMAT(DATE_ADD(?, INTERVAL 6 DAY), '%Y/%m/%d')
         END AS session_date,
         CASE s.day_of_week
           WHEN 1 THEN 'Monday'
           WHEN 2 THEN 'Tuesday'
           WHEN 3 THEN 'Wednesday'
           WHEN 4 THEN 'Thursday'
           WHEN 5 THEN 'Friday'
           WHEN 6 THEN 'Saturday'
           WHEN 7 THEN 'Sunday'
         END AS day_name,
         s.start_time, 
         s.end_time, 
         s.total_cost,
         sp.name AS sport_name,
         st.name AS stadium_name, 
         st.address, 
         st.google_maps_link,
         l.location_name,
         CONCAT(u.first_name, ' ', u.last_name) AS coach_name
       FROM sessions s
       JOIN sports sp ON s.sport_id = sp.id
       JOIN stadiums st ON s.stadium_id = st.id
       JOIN locations l ON st.location_id = l.location_id
       LEFT JOIN users u ON s.coach_id = u.id
       WHERE s.id = ?`,
      [nextMonday, nextMonday, nextMonday, nextMonday, nextMonday, nextMonday, nextMonday, sessionId]
    );
    if (details.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking details not found'
      });
    }
    const bookingDetails = {
      sportName: details[0].sport_name,
      stadiumName: details[0].stadium_name,
      locationName: details[0].location_name,
      sessionDate: details[0].session_date,
      dayName: details[0].day_name,
      startTime: details[0].start_time,
      endTime: details[0].end_time,
      address: details[0].address,
      coachName: details[0].coach_name || 'No coach assigned',
      googleMapsLink: details[0].google_maps_link
    };
    res.status(200).json({
      success: true,
      bookingDetails
    });
  } catch (error) {
    console.error('Error fetching booking details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking details',
      error: error.message
    });
  }
};

// Initiate PayHere payment
exports.initiatePayment = async (req, res) => {
  try {
    const { sessionId, playerId } = req.body;
    if (!sessionId || !playerId) {
      return res.status(400).json({
        success: false,
        message: 'sessionId and playerId are required'
      });
    }

    // Calculate booking_date for the session
    const today = new Date();
    const currentDay = today.getDay();
    const daysToNextMonday = currentDay === 0 ? 1 : 8 - currentDay;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysToNextMonday);

    const [session] = await executeQuery(
      `SELECT id, total_cost, status, no_of_players, max_players, day_of_week
       FROM sessions
       WHERE id = ? AND status = 'available'`,
      [sessionId]
    );
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or unavailable'
      });
    }
    if (session.no_of_players >= session.max_players) {
      return res.status(400).json({
        success: false,
        message: 'This session is fully booked'
      });
    }

    // Calculate booking_date
    const bookingDate = new Date(nextMonday);
    bookingDate.setDate(nextMonday.getDate() + (session.day_of_week - 1));

    // Check if player has already booked this session for the booking_date
    const existingBooking = await executeQuery(
      `SELECT id FROM player_bookings 
       WHERE player_id = ? AND session_id = ? AND booking_date = ?`,
      [playerId, sessionId, bookingDate.toISOString().split('T')[0]]
    );
    if (existingBooking.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already booked this session'
      });
    }

    // Fetch player details from users table
    const players = await executeQuery(
      `SELECT u.first_name, u.last_name, u.email
       FROM users u
       JOIN player_details pd ON u.id = pd.userId
       WHERE u.id = ? AND u.role = 'player'`,
      [playerId]
    );
    if (players.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Player not found or not a player role'
      });
    }

    const amount = parseFloat(session.total_cost);
    if (!session.total_cost || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid session total_cost: ${session.total_cost}`
      });
    }

    const player = players[0];
    const orderId = `SESSION_${sessionId}_${playerId}_${Date.now()}`;
    const merchantId = process.env.PAYHERE_MERCHANT_ID || 'YOUR_SANDBOX_MERCHANT_ID';
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || 'YOUR_SANDBOX_MERCHANT_SECRET';
    const currency = 'LKR';

    // Insert pending payment
    await executeQuery(
      `INSERT INTO payments (player_id, session_id, amount, order_id, status, payment_date)
       VALUES (?, ?, ?, ?, 'pending', NULL)`,
      [playerId, sessionId, amount, orderId]
    );

    // Generate PayHere hash
    const formattedAmount = Number(amount).toFixed(2);
    const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const hashInput = merchantId + orderId + formattedAmount + currency + hashedSecret;
    const hash = crypto.createHash('md5').update(hashInput).digest('hex').toUpperCase();

    const paymentData = {
      merchant_id: merchantId,
      return_url: 'http://localhost:4200/player/payment-success',
      cancel_url: 'http://localhost:4200/player/payment-cancel',
      notify_url: 'https://d106-45-121-88-32.ngrok-free.app/api/sessions/payment-webhook',
      order_id: orderId,
      items: `Session Booking #${sessionId}`,
      currency: currency,
      amount: formattedAmount,
      first_name: player.first_name,
      last_name: player.last_name || '',
      email: player.email,
      phone: '0771234567',
      address: 'No. 1, Galle Road',
      city: 'Colombo',
      country: 'Sri Lanka',
      hash: hash
    };

    res.status(200).json({
      success: true,
      payment: paymentData
    });
  } catch (error) {
    console.error('Error initiating payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
      error: error.message
    });
  }
};

// Handle PayHere webhook
exports.handlePaymentWebhook = async (req, res) => {
  console.log('Webhook called with body:', JSON.stringify(req.body, null, 2));

  try {
    const { merchant_id, order_id, payment_id, status_code, md5sig } = req.body;

    if (!merchant_id || !order_id || !payment_id || !status_code || !md5sig) {
      console.error('Missing required webhook parameters:', req.body);
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || 'YOUR_SANDBOX_MERCHANT_SECRET';
    const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const hashInput = merchant_id + order_id + payment_id + status_code + hashedSecret;
    const localSig = crypto.createHash('md5').update(hashInput).digest('hex').toUpperCase();

    console.log('Signature verification:', { localSig, md5sig, hashInput });

    if (localSig !== md5sig) {
      console.error('Invalid signature:', { localSig, md5sig });
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    let status = 'pending';
    if (status_code === '2') status = 'completed';
    else if (status_code === '0') status = 'pending';
    else if (status_code === '-1') status = 'cancelled';
    else if (status_code === '-2') status = 'failed';

    console.log('Payment status:', status);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Update payments table
      const [paymentUpdateResult] = await connection.execute(
        `UPDATE payments
         SET status = ?, transaction_id = ?, payment_date = NOW()
         WHERE order_id = ?`,
        [status, payment_id, order_id]
      );
      console.log('Payment update result:', paymentUpdateResult);

      if (status === 'completed') {
        // Fetch payment details
        const [payments] = await connection.execute(
          `SELECT id, player_id, session_id
           FROM payments
           WHERE order_id = ?`,
          [order_id]
        );
        if (payments.length === 0) {
          throw new Error('Payment record not found');
        }
        const payment = payments[0];
        console.log('Payment details:', payment);

        // Calculate booking_date
        const today = new Date();
        const currentDay = today.getDay();
        const daysToNextMonday = currentDay === 0 ? 1 : 8 - currentDay;
        const nextMonday = new Date(today);
        nextMonday.setDate(today.getDate() + daysToNextMonday);

        const [session] = await connection.execute(
          `SELECT day_of_week
           FROM sessions
           WHERE id = ?`,
          [payment.session_id]
        );
        if (session.length === 0) {
          throw new Error('Session not found');
        }

        const bookingDate = new Date(nextMonday);
        bookingDate.setDate(nextMonday.getDate() + (session.day_of_week - 1));

        // Verify session exists and is not full
        const [sessionData] = await connection.execute(
          `SELECT no_of_players, max_players
           FROM sessions
           WHERE id = ?`,
          [payment.session_id]
        );
        if (sessionData.length === 0) {
          throw new Error('Session not found');
        }
        if (sessionData.no_of_players >= sessionData.max_players) {
          throw new Error('Session is fully booked');
        }
        console.log('Session before update:', sessionData);

        // Increment no_of_players
        const [sessionUpdateResult] = await connection.execute(
          `UPDATE sessions
           SET no_of_players = no_of_players + 1,
               status = IF(no_of_players + 1 >= max_players, 'booked', 'available')
           WHERE id = ?`,
          [payment.session_id]
        );
        console.log('Session update result:', sessionUpdateResult);

        // Insert into player_bookings
        const [bookingInsertResult] = await connection.execute(
          `INSERT INTO player_bookings (player_id, session_id, booking_date, payment_id)
           VALUES (?, ?, ?, ?)`,
          [payment.player_id, payment.session_id, bookingDate.toISOString().split('T')[0], payment.id]
        );
        console.log('Player booking insert result:', bookingInsertResult);
      }

      await connection.commit();
      console.log('Webhook transaction committed successfully');
      res.status(200).json({ success: true });
    } catch (error) {
      await connection.rollback();
      console.error('Error in webhook transaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process webhook',
        error: error.message
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to handle webhook',
      error: error.message
    });
  }
};

// Complete payment from frontend
exports.completePayment = async (req, res) => {
  try {
    const { order_id, transaction_id } = req.body;
    if (!order_id || !transaction_id) {
      return res.status(400).json({
        success: false,
        message: 'order_id and transaction_id are required'
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Update payments table
      const [paymentUpdateResult] = await connection.execute(
        `UPDATE payments
         SET status = 'completed', transaction_id = ?, payment_date = NOW()
         WHERE order_id = ? AND status = 'pending'`,
        [transaction_id, order_id]
      );
      console.log('Payment update result:', paymentUpdateResult);

      if (paymentUpdateResult.affectedRows === 0) {
        throw new Error('Payment not found or already processed');
      }

      // Fetch payment details
      const [payments] = await connection.execute(
        `SELECT id, player_id, session_id
         FROM payments
         WHERE order_id = ?`,
        [order_id]
      );
      if (payments.length === 0) {
        throw new Error('Payment record not found');
      }
      const payment = payments[0];
      console.log('Payment details:', payment);

      // Calculate booking_date
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of day
      const currentDay = today.getDay();
      const daysToNextMonday = currentDay === 0 ? 1 : 8 - currentDay;
      const nextMonday = new Date(today.getTime() + daysToNextMonday * 24 * 60 * 60 * 1000);

      const [session] = await connection.execute(
        `SELECT day_of_week
         FROM sessions
         WHERE id = ?`,
        [payment.session_id]
      );
      if (session.length === 0) {
        throw new Error('Session not found');
      }

      // Calculate booking_date based on day_of_week
      const dayOffset = session[0].day_of_week - 1; // day_of_week is 1=Monday, ..., 7=Sunday
      const bookingDate = new Date(nextMonday.getTime() + dayOffset * 24 * 60 * 60 * 1000);

      // Verify session exists and is not full
      const [sessionData] = await connection.execute(
        `SELECT no_of_players, max_players
         FROM sessions
         WHERE id = ?`,
        [payment.session_id]
      );
      if (sessionData.length === 0) {
        throw new Error('Session not found');
      }
      if (sessionData[0].no_of_players >= sessionData[0].max_players) {
        throw new Error('Session is fully booked');
      }
      console.log('Session before update:', sessionData[0]);

      // Increment no_of_players
      const [sessionUpdateResult] = await connection.execute(
        `UPDATE sessions
         SET no_of_players = no_of_players + 1,
             status = IF(no_of_players + 1 >= max_players, 'booked', 'available')
         WHERE id = ?`,
        [payment.session_id]
      );
      console.log('Session update result:', sessionUpdateResult);

      // Insert into player_bookings
      const [bookingInsertResult] = await connection.execute(
        `INSERT INTO player_bookings (player_id, session_id, booking_date, payment_id)
         VALUES (?, ?, ?, ?)`,
        [payment.player_id, payment.session_id, bookingDate.toISOString().split('T')[0], payment.id]
      );
      console.log('Player booking insert result:', bookingInsertResult);

      await connection.commit();
      console.log('Payment completion transaction committed successfully');
      res.status(200).json({
        success: true,
        message: 'Payment completed successfully'
      });
    } catch (error) {
      await connection.rollback();
      console.error('Error in complete payment transaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete payment',
        error: error.message
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error completing payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete payment',
      error: error.message
    });
  }
};

// Set sport cost for a stadium-sport combination (Stadium Owner)
exports.setSportCost = async (req, res) => {
  try {
    const { stadiumId, sportId, sportCost } = req.body;
    if (!stadiumId || !sportId || sportCost == null || sportCost < 0) {
      return res.status(400).json({
        success: false,
        message: 'stadiumId, sportId, and sportCost (non-negative) are required'
      });
    }

    const existing = await executeQuery(
      `SELECT id FROM stadium_sports WHERE stadium_id = ? AND sport_id = ?`,
      [stadiumId, sportId]
    );
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Stadium-sport combination not found'
      });
    }

    await executeQuery(
      `UPDATE stadium_sports SET sport_percentage = ? WHERE stadium_id = ? AND sport_id = ?`,
      [parseFloat(sportCost), stadiumId, sportId]
    );

    res.status(200).json({
      success: true,
      message: 'Sport cost updated successfully'
    });
  } catch (error) {
    console.error('Error setting sport cost:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set sport cost',
      error: error.message
    });
  }
};

// Create a session (Coach)
exports.createSession = async (req, res) => {
  try {
    const { stadiumId, coachId, dayOfWeek, startTime, endTime, maxPlayers, sportId, coachCost } = req.body;
    if (!stadiumId || !coachId || !dayOfWeek || !startTime || !endTime || !maxPlayers || !sportId || coachCost == null || coachCost < 0) {
      return res.status(400).json({
        success: false,
        message: 'stadiumId, coachId, dayOfWeek, startTime, endTime, maxPlayers, sportId, and coachCost (non-negative) are required'
      });
    }

    const sportData = await executeQuery(
      `SELECT sport_percentage FROM stadium_sports WHERE stadium_id = ? AND sport_id = ?`,
      [stadiumId, sportId]
    );
    if (sportData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Stadium-sport combination not found'
      });
    }

    const sportPercentage = parseFloat(sportData[0].sport_percentage) || 0.00;
    const coachCostValue = parseFloat(coachCost);
    const stadiumSportCost = coachCostValue * (sportPercentage / 100);
    const totalCost = stadiumSportCost + coachCostValue;

    const result = await executeQuery(
      `INSERT INTO sessions (stadium_id, coach_id, day_of_week, start_time, end_time, max_players, sport_id, stadium_sport_cost, coach_cost, total_cost, status, no_of_players, recurring)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', 0, 1)`,
      [stadiumId, coachId, dayOfWeek, startTime, endTime, maxPlayers, sportId, stadiumSportCost, coachCostValue, totalCost]
    );

    res.status(201).json({
      success: true,
      sessionId: result.insertId,
      message: 'Session created successfully'
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create session',
      error: error.message
    });
  }
};

module.exports = {
  getLocations: exports.getLocations,
  getStadiumsByLocationAndSport: exports.getStadiumsByLocationAndSport,
  getStadiumsByLocation: exports.getStadiumsByLocation,
  getWeeklyTimetable: exports.getWeeklyTimetable,
  validateSession: exports.validateSession,
  getBookingDetails: exports.getBookingDetails,
  initiatePayment: exports.initiatePayment,
  handlePaymentWebhook: exports.handlePaymentWebhook,
  completePayment: exports.completePayment,
  setSportCost: exports.setSportCost,
  createSession: exports.createSession
};