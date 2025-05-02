
const pool = require('../config/db');

async function addStadium(req, res) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { name, address, google_maps_link, facilities, images, schedule } = req.body;
    console.log('Received stadium data:', req.body);
    if (!name || !address || !google_maps_link || !schedule || !Array.isArray(schedule) || schedule.length === 0) {
      throw new Error('Missing required fields: name, address, google_maps_link, or schedule');
    }
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new Error('No token provided');
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const ownerId = decoded.id;
    const sqlStadium = `
      INSERT INTO stadiums (name, address, google_maps_link, facilities, images, owner_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [stadiumResult] = await connection.execute(sqlStadium, [
      name,
      address,
      google_maps_link,
      facilities,
      JSON.stringify(images || []),
      ownerId
    ]);
    const stadiumId = stadiumResult.insertId;
    const uniqueSports = [...new Set(schedule.map(session => session.sport))];
    for (const sport of uniqueSports) {
      const [sportRows] = await connection.execute('SELECT id FROM sports WHERE name = ?', [sport]);
      if (sportRows.length === 0) {
        console.warn(`Sport ${sport} not found. Skipping.`);
        continue;
      }
      const sportId = sportRows[0].id;
      await connection.execute('INSERT INTO stadium_sports (stadium_id, sport_id) VALUES (?, ?)', [stadiumId, sportId]);
    }
    for (const session of schedule) {
      const { sport, day, fromTime, toTime, maxPlayers } = session;
      const [sportRows] = await connection.execute('SELECT id FROM sports WHERE name = ?', [sport]);
      if (sportRows.length === 0) {
        console.warn(`Sport ${sport} not found. Skipping.`);
        continue;
      }
      const sportId = sportRows[0].id;
      if (typeof maxPlayers !== 'number' || maxPlayers <= 0) {
        console.warn(`Invalid maxPlayers for sport ${sport}: ${maxPlayers}. Skipping.`);
        continue;
      }
      const today = new Date();
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const targetDayIndex = daysOfWeek.indexOf(day);
      if (targetDayIndex === -1) {
        console.warn(`Invalid day ${day} for sport ${sport}. Skipping.`);
        continue;
      }
      const currentDayIndex = today.getDay();
      let daysUntilTarget = targetDayIndex - currentDayIndex;
      if (daysUntilTarget <= 0) daysUntilTarget += 7;
      const sessionDate = new Date(today);
      sessionDate.setDate(today.getDate() + daysUntilTarget);
      const formattedDate = sessionDate.toISOString().split('T')[0];
      const sqlSession = `
        INSERT INTO sessions (stadium_id, sport_id, session_date, start_time, end_time, max_players, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      await connection.execute(sqlSession, [
        stadiumId,
        sportId,
        formattedDate,
        fromTime,
        toTime,
        maxPlayers,
        'available'
      ]);
    }
    await connection.commit();
    res.status(201).json({ message: 'Stadium and sessions added successfully', stadiumId });
  } catch (error) {
    await connection.rollback();
    console.error('Error adding stadium:', error);
    res.status(500).json({ message: 'Error adding stadium', error: error.message });
  } finally {
    connection.release();
  }
}

module.exports = { addStadium };