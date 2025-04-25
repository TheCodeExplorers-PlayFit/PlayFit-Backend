const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root', // Update with your MySQL username
  password: '', // Update with your MySQL password
  database: 'sports_app'
});

exports.getUnverifiedUsers = async (req, res) => {
  try {
    const [coaches] = await pool.query(`
      SELECT u.id AS userId, u.first_name, u.last_name, u.role, u.created_at, cd.documentPath
      FROM users u
      INNER JOIN coach_details cd ON u.id = cd.userId
      WHERE u.role = 'coach' AND cd.verified = 0
    `).catch(err => {
      throw new Error('Coach query failed: ' + err.message);
    });

    const [medicalOfficers] = await pool.query(`
      SELECT u.id AS userId, u.first_name, u.last_name, u.role, u.created_at, medical_officer_details.documentPath
      FROM users u
      INNER JOIN medical_officer_details ON u.id = medical_officer_details.userId
      WHERE u.role = 'medicalOfficer' AND medical_officer_details.isVerified = 0
    `).catch(err => {
      throw new Error('Medical Officer query failed: ' + err.message);
    });

    const [stadiums] = await pool.query(`
      SELECT id AS userId, 'stadium' AS role, name AS facilityName
      FROM stadiums
      WHERE isVerified = 0
    `).catch(err => {
      throw new Error('Stadium query failed: ' + err.message);
    });

    const unverifiedUsers = [...coaches, ...medicalOfficers, ...stadiums];
    res.json(unverifiedUsers);
  } catch (err) {
    console.error('Error fetching unverified users:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

exports.getVerifiedUsers = async (req, res) => {
  try {
    const [coaches] = await pool.query(`
      SELECT u.id AS userId, u.first_name, u.last_name, u.role, u.created_at, cd.documentPath
      FROM users u
      INNER JOIN coach_details cd ON u.id = cd.userId
      WHERE u.role = 'coach' AND cd.verified = 1
    `).catch(err => {
      throw new Error('Coach query failed: ' + err.message);
    });

    const [medicalOfficers] = await pool.query(`
      SELECT u.id AS userId, u.first_name, u.last_name, u.role, u.created_at, medical_officer_details.documentPath
      FROM users u
      INNER JOIN medical_officer_details ON u.id = medical_officer_details.userId
      WHERE u.role = 'medicalOfficer' AND medical_officer_details.isVerified = 1
    `).catch(err => {
      throw new Error('Medical Officer query failed: ' + err.message);
    });

    const [stadiums] = await pool.query(`
      SELECT id AS userId, 'stadium' AS role, name AS facilityName
      FROM stadiums
      WHERE isVerified = 1
    `).catch(err => {
      throw new Error('Stadium query failed: ' + err.message);
    });

    const verifiedUsers = [...coaches, ...medicalOfficers, ...stadiums];
    res.json(verifiedUsers);
  } catch (err) {
    console.error('Error fetching verified users:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

exports.approveUser = async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  try {
    if (role === 'Coach') {
      const [user] = await pool.query('SELECT id FROM users WHERE id = ? AND role = ?', [userId, 'coach']);
      if (!user[0]) return res.status(404).json({ error: 'User not found' });
      await pool.query('UPDATE coach_details SET verified = 1 WHERE userId = ?', [userId]);
    } else if (role === 'Medical Officer') {
      const [user] = await pool.query('SELECT id FROM users WHERE id = ? AND role = ?', [userId, 'medicalOfficer']);
      if (!user[0]) return res.status(404).json({ error: 'User not found' });
      await pool.query('UPDATE medical_officer_details SET isVerified = 1 WHERE userId = ?', [userId]);
    } else if (role === 'Stadium') {
      const [stadium] = await pool.query('SELECT id FROM stadiums WHERE id = ?', [userId]);
      if (!stadium[0]) return res.status(404).json({ error: 'Stadium not found' });
      await pool.query('UPDATE stadiums SET isVerified = 1 WHERE id = ?', [userId]);
    } else {
      return res.status(400).json({ error: 'Invalid role for approval' });
    }

    res.status(200).json({ message: 'Approved successfully' });
  } catch (err) {
    console.error('Error approving user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.rejectUser = async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  try {
    if (role === 'Coach') {
      const [user] = await pool.query('SELECT id FROM users WHERE id = ? AND role = ?', [userId, 'coach']);
      if (!user[0]) return res.status(404).json({ error: 'User not found' });
      await pool.query('DELETE FROM coach_details WHERE userId = ?', [userId]);
      await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    } else if (role === 'Medical Officer') {
      const [user] = await pool.query('SELECT id FROM users WHERE id = ? AND role = ?', [userId, 'medicalOfficer']);
      if (!user[0]) return res.status(404).json({ error: 'User not found' });
      await pool.query('DELETE FROM medical_officer_details WHERE userId = ?', [userId]);
      await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    } else if (role === 'Stadium') {
      const [stadium] = await pool.query('SELECT id FROM stadiums WHERE id = ?', [userId]);
      if (!stadium[0]) return res.status(404).json({ error: 'Stadium not found' });
      await pool.query('DELETE FROM stadium_sports WHERE stadium_id = ?', [userId]);
      await pool.query('DELETE FROM sessions WHERE stadium_id = ?', [userId]);
      await pool.query('DELETE FROM stadiums WHERE id = ?', [userId]);
    } else {
      return res.status(400).json({ error: 'Invalid role for rejection' });
    }

    res.status(200).json({ message: 'Rejected successfully' });
  } catch (err) {
    console.error('Error rejecting user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};