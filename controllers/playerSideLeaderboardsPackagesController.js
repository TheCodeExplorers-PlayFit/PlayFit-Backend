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

// Fetch leaderboards
exports.getLeaderboards = async (req, res) => {
  try {
    const leaderboards = await executeQuery(`
      SELECT 
        CONCAT(u.first_name, ' ', u.last_name) AS player_name,
        s.name AS stadium_name,
        COUNT(pb.id) AS booking_count
      FROM player_bookings pb
      JOIN users u ON pb.player_id = u.id
      JOIN sessions se ON pb.session_id = se.id
      JOIN stadiums s ON se.stadium_id = s.id
      WHERE u.role = 'player'
      GROUP BY pb.player_id, se.stadium_id
      ORDER BY booking_count DESC
      LIMIT 100
    `);
    res.status(200).json({
      success: true,
      leaderboards
    });
  } catch (error) {
    console.error('Error fetching leaderboards:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboards',
      error: error.message
    });
  }
};

// Fetch available and assigned packages
exports.getPackages = async (req, res) => {
  try {
    const { playerId } = req.query;
    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: 'playerId is required'
      });
    }

    const availablePackages = await executeQuery(`
      SELECT pp.*, s.name AS stadium_name
      FROM player_packages pp
      JOIN stadiums s ON pp.stadium_id = s.id
      WHERE pp.id NOT IN (
        SELECT package_id 
        FROM player_package_assignments 
        WHERE player_id = ?
      )
    `, [playerId]);

    const assignedPackages = await executeQuery(`
      SELECT pp.*, s.name AS stadium_name
      FROM player_package_assignments ppa
      JOIN player_packages pp ON ppa.package_id = pp.id
      JOIN stadiums s ON pp.stadium_id = s.id
      WHERE ppa.player_id = ?
    `, [playerId]);

    res.status(200).json({
      success: true,
      availablePackages,
      assignedPackages
    });
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch packages',
      error: error.message
    });
  }
};

// Initiate package payment
exports.initiatePackagePayment = async (req, res) => {
  try {
    const { packageId, playerId } = req.body;
    if (!packageId || !playerId) {
      return res.status(400).json({
        success: false,
        message: 'packageId and playerId are required'
      });
    }

    const packages = await executeQuery(
      `SELECT pp.*, s.name AS stadium_name
       FROM player_packages pp
       JOIN stadiums s ON pp.stadium_id = s.id
       WHERE pp.id = ?`,
      [packageId]
    );
    if (packages.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    const player = await executeQuery(
      `SELECT first_name, last_name, email
       FROM users
       WHERE id = ? AND role = 'player'`,
      [playerId]
    );
    if (player.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    const packageData = packages[0];
    const amount = parseFloat(packageData.price);
    const orderId = `PACKAGE_${packageId}_${playerId}_${Date.now()}`;
    const merchantId = process.env.PAYHERE_MERCHANT_ID || 'YOUR_SANDBOX_MERCHANT_ID';
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || 'YOUR_SANDBOX_MERCHANT_SECRET';
    const currency = 'LKR';

    await executeQuery(
      `INSERT INTO payments (player_id, amount, order_id, status, payment_date)
       VALUES (?, ?, ?, 'pending', NULL)`,
      [playerId, amount, orderId]
    );

    const formattedAmount = Number(amount).toFixed(2);
    const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const hashInput = merchantId + orderId + formattedAmount + currency + hashedSecret;
    const hash = crypto.createHash('md5').update(hashInput).digest('hex').toUpperCase();

    const paymentData = {
      merchant_id: merchantId,
      return_url: 'http://localhost:4200/player/special-offers',
      cancel_url: 'http://localhost:4200/player/special-offers',
      notify_url: 'https://d106-45-121-88-32.ngrok-free.app/api/player-leaderboards/package-payment-webhook',
      order_id: orderId,
      items: `Package #${packageId}`,
      currency: currency,
      amount: formattedAmount,
      first_name: player[0].first_name,
      last_name: player[0].last_name || '',
      email: player[0].email,
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
    console.error('Error initiating package payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
      error: error.message
    });
  }
};

// Handle package payment webhook
exports.handlePackagePaymentWebhook = async (req, res) => {
  try {
    const { merchant_id, order_id, payment_id, status_code, md5sig } = req.body;

    if (!merchant_id || !order_id || !payment_id || !status_code || !md5sig) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || 'YOUR_SANDBOX_MERCHANT_SECRET';
    const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
    const hashInput = merchant_id + order_id + payment_id + status_code + hashedSecret;
    const localSig = crypto.createHash('md5').update(hashInput).digest('hex').toUpperCase();

    if (localSig !== md5sig) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    let status = 'pending';
    if (status_code === '2') status = 'completed';
    else if (status_code === '0') status = 'pending';
    else if (status_code === '-1') status = 'cancelled';
    else if (status_code === '-2') status = 'failed';

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [paymentUpdateResult] = await connection.execute(
        `UPDATE payments
         SET status = ?, transaction_id = ?, payment_date = NOW()
         WHERE order_id = ?`,
        [status, payment_id, order_id]
      );

      if (status === 'completed') {
        const [payment] = await connection.execute(
          `SELECT player_id, amount
           FROM payments
           WHERE order_id = ?`,
          [order_id]
        );
        if (payment.length === 0) {
          throw new Error('Payment record not found');
        }

        const packageId = parseInt(order_id.split('_')[1]);
        const playerId = payment[0].player_id;

        const [packageData] = await connection.execute(
          `SELECT start_date, end_date
           FROM player_packages
           WHERE id = ?`,
          [packageId]
        );
        if (packageData.length === 0) {
          throw new Error('Package not found');
        }

        await connection.execute(
          `INSERT INTO player_package_assignments (player_id, package_id, start_date, end_date)
           VALUES (?, ?, ?, ?)`,
          [playerId, packageId, packageData[0].start_date, packageData[0].end_date]
        );
      }

      await connection.commit();
      res.status(200).json({ success: true });
    } catch (error) {
      await connection.rollback();
      res.status(500).json({
        success: false,
        message: 'Failed to process webhook',
        error: error.message
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to handle webhook',
      error: error.message
    });
  }
};

// Confirm package assignment
exports.confirmPackageAssignment = async (req, res) => {
  try {
    const { order_id, playerId } = req.body;

    if (!order_id || !playerId) {
      return res.status(400).json({
        success: false,
        message: 'order_id and playerId are required'
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [payment] = await connection.execute(
        `SELECT player_id, status
         FROM payments
         WHERE order_id = ? AND player_id = ?`,
        [order_id, playerId]
      );

      if (payment.length === 0) {
        throw new Error('Payment record not found');
      }

      if (payment[0].status !== 'completed') {
        throw new Error('Payment not completed');
      }

      const packageId = parseInt(order_id.split('_')[1]);
      const [packageData] = await connection.execute(
        `SELECT start_date, end_date
         FROM player_packages
         WHERE id = ?`,
        [packageId]
      );

      if (packageData.length === 0) {
        throw new Error('Package not found');
      }

      const [existingAssignment] = await connection.execute(
        `SELECT id
         FROM player_package_assignments
         WHERE player_id = ? AND package_id = ?`,
        [playerId, packageId]
      );

      if (existingAssignment.length === 0) {
        await connection.execute(
          `INSERT INTO player_package_assignments (player_id, package_id, start_date, end_date)
           VALUES (?, ?, ?, ?)`,
          [playerId, packageId, packageData[0].start_date, packageData[0].end_date]
        );
      }

      await connection.commit();
      res.status(200).json({
        success: true,
        message: 'Package successfully assigned'
      });
    } catch (error) {
      await connection.rollback();
      res.status(500).json({
        success: false,
        message: 'Failed to confirm package assignment',
        error: error.message
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to confirm package assignment',
      error: error.message
    });
  }
};

module.exports = {
  getLeaderboards: exports.getLeaderboards,
  getPackages: exports.getPackages,
  initiatePackagePayment: exports.initiatePackagePayment,
  handlePackagePaymentWebhook: exports.handlePackagePaymentWebhook,
  confirmPackageAssignment: exports.confirmPackageAssignment
};