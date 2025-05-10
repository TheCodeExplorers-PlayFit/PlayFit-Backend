const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'sports_app',
  port: 3306
});

// Get all maintenance requests for stadium owner
exports.getMaintenanceRequests = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT r.id, r.reported_by, r.reported_to, r.stadium_id, r.description, r.status, r.created_at ' +
      'FROM reports r WHERE r.reported_to = ?',
      ['stadiumOwner']
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching maintenance requests:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance requests' });
  }
};

// Update maintenance request status
exports.updateMaintenanceRequest = async (req, res) => {
  const { id, status } = req.body;
  if (!id || !status) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!['pending', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }
  try {
    const [result] = await pool.query(
      'UPDATE reports SET status = ? WHERE id = ? AND reported_to = ?',
      [status, id, 'stadiumOwner']
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Maintenance request not found or unauthorized' });
    }
    res.json({ message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error updating maintenance request status:', error);
    res.status(500).json({ error: 'Failed to update maintenance request status' });
  }
};