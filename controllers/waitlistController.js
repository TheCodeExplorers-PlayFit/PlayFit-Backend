// controllers/waitlistController.js
const pool = require('../config/db');

async function addToWaitlist(req, res) {
  const connection = await pool.getConnection();
  try {
    const { user_id, session_id } = req.body;
    const ownerId = req.user.id;

    // Verify the stadium owner owns the session's stadium
    const [sessionRows] = await connection.execute(
      'SELECT s.stadium_id FROM sessions s JOIN stadiums st ON s.stadium_id = st.id WHERE s.id = ? AND st.owner_id = ?',
      [session_id, ownerId]
    );
    if (sessionRows.length === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to session' });
    }

    const [result] = await connection.execute(
      'INSERT INTO waitlist (user_id, session_id, status) VALUES (?, ?, ?)',
      [user_id, session_id, 'pending']
    );

    res.status(201).json({ success: true, message: 'Added to waitlist', waitlistId: result.insertId });
  } catch (error) {
    console.error('Error in addToWaitlist:', error.stack);
    res.status(500).json({ success: false, message: 'Error adding to waitlist', error: error.message });
  } finally {
    connection.release();
  }
}

async function getWaitlist(req, res) {
  const connection = await pool.getConnection();
  try {
    const ownerId = req.user.id;
    const [rows] = await connection.execute(
      'SELECT w.id, CONCAT(u.first_name, " ", u.last_name) AS user_name, u.role AS user_type, w.requested_date, ' +
      's.start_time, s.end_time, s.day_of_week, w.status ' +
      'FROM waitlist w ' +
      'JOIN users u ON w.user_id = u.id ' +
      'JOIN sessions s ON w.session_id = s.id ' +
      'JOIN stadiums st ON s.stadium_id = st.id ' +
      'WHERE st.owner_id = ?',
      [ownerId]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error in getWaitlist:', error.stack);
    res.status(500).json({ success: false, message: 'Error fetching waitlist', error: error.message });
  } finally {
    connection.release();
  }
}

async function updateWaitlistStatus(req, res) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { waitlist_id, status } = req.body;
    const ownerId = req.user.id;

    const [waitlistRows] = await connection.execute(
      'SELECT s.stadium_id FROM waitlist w ' +
      'JOIN sessions s ON w.session_id = s.id ' +
      'JOIN stadiums st ON s.stadium_id = st.id ' +
      'WHERE w.id = ? AND st.owner_id = ?',
      [waitlist_id, ownerId]
    );
    if (waitlistRows.length === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to waitlist entry' });
    }

    const [result] = await connection.execute(
      'UPDATE waitlist SET status = ? WHERE id = ?',
      [status, waitlist_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Waitlist entry not found' });
    }

    await connection.commit();
    res.status(200).json({ success: true, message: 'Waitlist status updated' });
  } catch (error) {
    await connection.rollback();
    console.error('Error in updateWaitlistStatus:', error.stack);
    res.status(500).json({ success: false, message: 'Error updating waitlist status', error: error.message });
  } finally {
    connection.release();
  }
}

async function getWaitlistStats(req, res) {
  const connection = await pool.getConnection();
  try {
    const ownerId = req.user.id;
    const [rows] = await connection.execute(
      'SELECT ' +
      'COUNT(*) AS total_waitlist_requests, ' +
      'SUM(CASE WHEN w.status = "pending" THEN 1 ELSE 0 END) AS pending_requests, ' +
      'SUM(CASE WHEN w.status = "approved" THEN 1 ELSE 0 END) AS approved_requests, ' +
      'CONCAT(s.start_time, " - ", s.end_time, " on ", s.day_of_week) AS most_requested_slot ' +
      'FROM waitlist w ' +
      'JOIN sessions s ON w.session_id = s.id ' +
      'JOIN stadiums st ON s.stadium_id = st.id ' +
      'WHERE st.owner_id = ? ' +
      'GROUP BY s.start_time, s.end_time, s.day_of_week ' +
      'ORDER BY COUNT(*) DESC ' +
      'LIMIT 1',
      [ownerId]
    );
    const stats = rows.length > 0 ? {
      total_waitlist_requests: rows[0].total_waitlist_requests,
      pending_requests: rows[0].pending_requests,
      approved_requests: rows[0].approved_requests,
      most_requested_slot: rows[0].most_requested_slot
    } : {
      total_waitlist_requests: 0,
      pending_requests: 0,
      approved_requests: 0,
      most_requested_slot: null
    };
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error in getWaitlistStats:', error.stack);
    res.status(500).json({ success: false, message: 'Error fetching waitlist stats', error: error.message });
  } finally {
    connection.release();
  }
}

module.exports = { addToWaitlist, getWaitlist, updateWaitlistStatus, getWaitlistStats };