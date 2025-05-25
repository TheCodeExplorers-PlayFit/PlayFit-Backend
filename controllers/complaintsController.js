const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'sports_app',
  port: 3306
});

// Get all stadiums for complaint form
exports.getStadiums = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name FROM stadiums');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching stadiums:', error);
    res.status(500).json({ error: 'Failed to fetch stadiums' });
  }
};

// Get all coaches for complaint form
exports.getCoaches = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, first_name, last_name FROM users WHERE role = ?',
      ['coach']
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching coaches:', error);
    res.status(500).json({ error: 'Failed to fetch coaches' });
  }
};

// Submit a complaint
exports.submitComplaint = async (req, res) => {
  const { player_id, type, stadium_id, coach_id, description } = req.body;

  if (!player_id || !type || !description) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    let reported_to = 'admin';
    let queryParams = [player_id, reported_to, description];

    if (type === 'stadium') {
      if (!stadium_id) {
        return res.status(400).json({ error: 'Stadium ID required' });
      }
      reported_to = 'stadiumOwner';
      queryParams = [player_id, reported_to, stadium_id, null, description];
    } else if (type === 'coach') {
      if (!coach_id) {
        return res.status(400).json({ error: 'Coach ID required' });
      }
      queryParams = [player_id, reported_to, null, coach_id, description];
    }

    const query = `
      INSERT INTO reports (reported_by, reported_to, stadium_id, coach_id, description, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `;
    await pool.query(query, queryParams);

    res.status(201).json({ message: 'Complaint submitted successfully' });
  } catch (error) {
    console.error('Error submitting complaint:', error);
    res.status(500).json({ error: 'Failed to submit complaint' });
  }
};