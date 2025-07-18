// refundController.js
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

// Initiate a refund request by cancelling a booking
exports.requestRefund = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { bookingId, playerId } = req.body;

    if (!bookingId || !playerId) {
      return res.status(400).json({
        success: false,
        message: 'bookingId and playerId are required',
      });
    }

    await connection.beginTransaction();

    // Verify the booking exists and belongs to the player
    const bookings = await executeQuery(
      `SELECT pb.id, pb.session_id, pb.payment_id
       FROM player_bookings pb
       WHERE pb.id = ? AND pb.player_id = ?`,
      [bookingId, playerId]
    );

    if (bookings.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Booking not found or does not belong to this player',
      });
    }

    const booking = bookings[0];

    // Check if the session is in the future
    const currentDate = new Date().toISOString().split('T')[0];
    const sessions = await executeQuery(
      `SELECT s.id
       FROM sessions s
       JOIN player_bookings pb ON s.id = pb.session_id
       WHERE pb.id = ? AND pb.booking_date >= ?`,
      [bookingId, currentDate]
    );

    if (sessions.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel past or non-existent sessions',
      });
    }

    // Update payment status to 'cancelled'
    const paymentUpdateResult = await executeQuery(
      `UPDATE payments
       SET status = 'cancelled'
       WHERE id = ? AND player_id = ? AND status = 'completed'`,
      [booking.payment_id, playerId]
    );

    if (paymentUpdateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment not found or already cancelled',
      });
    }

    // Decrease no_of_players in sessions table
    const sessionUpdateResult = await executeQuery(
      `UPDATE sessions
       SET no_of_players = no_of_players - 1,
           status = 'available'
       WHERE id = ? AND no_of_players > 0`,
      [booking.session_id]
    );

    if (sessionUpdateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Failed to update session player count',
      });
    }

    // Remove the booking from player_bookings
    const bookingDeleteResult = await executeQuery(
      `DELETE FROM player_bookings
       WHERE id = ? AND player_id = ?`,
      [bookingId, playerId]
    );

    if (bookingDeleteResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Failed to delete booking',
      });
    }

    // Create a notification for the player
    await executeQuery(
      `INSERT INTO notifications (user_id, message, type, related_id, is_read)
       VALUES (?, ?, 'other', ?, 0)`,
      [
        playerId,
        'Your session booking has been cancelled. Please contact the stadium owner for refund processing.',
        bookingId,
      ]
    );

    await connection.commit();

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully. Please contact the stadium owner for refund processing.',
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error processing refund request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process refund request',
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  requestRefund: exports.requestRefund,
};