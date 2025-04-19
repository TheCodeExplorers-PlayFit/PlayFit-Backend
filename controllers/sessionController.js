const pool = require('../config/db');
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
      `SELECT s.id, s.stadium_id, s.sport_id, sp.name AS sport_name, s.coach_id, s.session_date, s.start_time, s.end_time, s.status, s.cost
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

// Validate session availability and fetch cost
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
      `SELECT id, cost, status
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
    res.status(200).json({
      success: true,
      session: sessions[0]
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

    // Validate session
    const sessions = await executeQuery(
      `SELECT id, cost, status
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

    // Fetch player details from users table
    const players = await executeQuery(
      `SELECT u.first_name, u.last_name, u.email
       FROM users u
       JOIN player_details pd ON u.id = pd.userId
       WHERE u.id = ? AND u.role = 'player'`,
      [playerId]
    );
    console.log('Players query result:', players);
    if (players.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Player not found or not a player role'
      });
    }

    const session = sessions[0];
    console.log('Session cost:', session.cost);
    const amount = parseFloat(session.cost);
    if (!session.cost || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid session cost: ${session.cost}`
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
    const formattedAmount = Number(amount).toFixed(2); // Ensure 1600.00 format
    const secretHash = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const hashInput = merchantId + orderId + formattedAmount + currency + secretHash;
    console.log('Hash inputs:', { merchantId, orderId, formattedAmount, currency, secretHash, hashInput });
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
      phone: '0771234567', // Placeholder, update if available
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
  try {
    const { merchant_id, order_id, payment_id, status_code, md5sig } = req.body;

    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || 'YOUR_SANDBOX_MERCHANT_SECRET';
    const localSig = crypto
      .createHash('md5')
      .update(merchant_id + order_id + payment_id + status_code + merchantSecret)
      .digest('hex')
      .toUpperCase();

    if (localSig !== md5sig) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    let status = 'pending';
    if (status_code == 2) status = 'completed';
    else if (status_code == 0) status = 'pending';
    else if (status_code == -1) status = 'cancelled';
    else if (status_code == -2) status = 'failed';

    await executeQuery(
      `UPDATE payments
       SET status = ?, transaction_id = ?, payment_date = NOW()
       WHERE order_id = ?`,
      [status, payment_id, order_id]
    );

    if (status === 'completed') {
      const payment = (await executeQuery(
        `SELECT player_id, session_id
         FROM payments
         WHERE order_id = ?`,
        [order_id]
      ))[0];

      await executeQuery(
        `INSERT INTO player_bookings (player_id, session_id, payment_id)
         SELECT ?, ?, id
         FROM payments
         WHERE order_id = ?`,
        [payment.player_id, payment.session_id, order_id]
      );

      await executeQuery(
        `UPDATE sessions
         SET status = 'booked'
         WHERE id = ?`,
        [payment.session_id]
      );
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to handle webhook',
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
  initiatePayment: exports.initiatePayment,
  handlePaymentWebhook: exports.handlePaymentWebhook
};