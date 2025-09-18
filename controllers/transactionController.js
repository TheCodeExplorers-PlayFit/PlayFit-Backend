const { pool } = require('../config/db');


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

// Fetch completed transactions for a player
exports.getPlayerTransactions = async (req, res) => {
  try {
    const { playerId } = req.params;
    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: 'playerId is required'
      });
    }

    const transactions = await executeQuery(
      `SELECT 
         p.id AS payment_id,
         p.amount,
         p.payment_date,
         p.order_id,
         p.transaction_id,
         p.status,
         pb.booking_date AS session_date,
         s.day_of_week,
         s.start_time,
         s.end_time,
         sp.name AS sport_name,
         st.name AS stadium_name,
         l.location_name
       FROM payments p
       JOIN player_bookings pb ON p.id = pb.payment_id
       JOIN sessions s ON pb.session_id = s.id
       JOIN sports sp ON s.sport_id = sp.id
       JOIN stadiums st ON s.stadium_id = st.id
       JOIN locations l ON st.location_id = l.location_id
       WHERE p.player_id = ? AND p.status = 'completed'
       ORDER BY p.payment_date DESC`,
      [playerId]
    );

    res.status(200).json({
      success: true,
      transactions
    });
  } catch (error) {
    console.error('Error fetching player transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
};

module.exports = {
  getPlayerTransactions: exports.getPlayerTransactions
};