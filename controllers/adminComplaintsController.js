const { sequelize } = require('../config/db');
const { QueryTypes } = require('sequelize');

exports.getAllComplaints = async (req, res) => {
  try {
    // Fetch Coach Complaints (where coach_id is not null)
    const coachComplaints = await sequelize.query(
      `SELECT r.id, r.reported_by, r.description, r.status, r.created_at, 
              u.first_name AS coach_first_name, u.last_name AS coach_last_name
       FROM reports r
       JOIN users u ON r.coach_id = u.id
       WHERE r.reported_to = 'admin' AND r.coach_id IS NOT NULL`,
      { type: QueryTypes.SELECT }
    );

    // Fetch System Complaints (where both coach_id and stadium_id are null)
    const systemComplaints = await sequelize.query(
      `SELECT r.id, r.reported_by, r.description, r.status, r.created_at
       FROM reports r
       WHERE r.reported_to = 'admin' AND r.coach_id IS NULL AND r.stadium_id IS NULL`,
      { type: QueryTypes.SELECT }
    );

    res.status(200).json({
      success: true,
      data: {
        coachComplaints,
        systemComplaints
      }
    });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.resolveComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const [updated] = await sequelize.query(
      `UPDATE reports SET status = 'resolved' WHERE id = ? AND reported_to = 'admin'`,
      { replacements: [id], type: QueryTypes.UPDATE }
    );

    if (updated === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found or not authorized' });
    }

    res.status(200).json({ success: true, message: 'Complaint resolved successfully' });
  } catch (error) {
    console.error('Error resolving complaint:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};