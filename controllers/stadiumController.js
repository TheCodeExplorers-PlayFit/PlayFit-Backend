const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Add Stadium (for Stadium Owners)
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
    if (!token) throw new Error('No token provided');

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

// Get Stadiums by Coach's Sports
async function getStadiumsByCoachSports(req, res) {
  try {
    const userId = req.user.id;

    if (req.user.role !== 'coach') {
      return res.status(403).json({ success: false, message: 'Only coaches can access this resource' });
    }

    const [coachSports] = await pool.execute(
      `SELECT sport1, sport2, sport3 FROM coach_details WHERE userId = ?`,
      [userId]
    );

    if (coachSports.length === 0) {
      return res.status(404).json({ success: false, message: 'Coach details not found' });
    }

    const sportsArray = [
      coachSports[0].sport1,
      coachSports[0].sport2,
      coachSports[0].sport3
    ].filter(sport => sport !== null && sport !== 0);

    if (sportsArray.length === 0) {
      return res.status(404).json({ success: false, message: 'No valid sports found for this coach' });
    }

    const placeholders = sportsArray.map(() => '?').join(',');
    const [stadiums] = await pool.execute(
      `SELECT DISTINCT s.id, s.name, s.description, s.images, s.address, l.location_name,
       GROUP_CONCAT(DISTINCT sp.name) as sport_names
       FROM stadiums s
       JOIN stadium_sports ss ON s.id = ss.stadium_id
       JOIN sports sp ON ss.sport_id = sp.id
       LEFT JOIN locations l ON s.location_id = l.location_id
       WHERE ss.sport_id IN (${placeholders})
       GROUP BY s.id`,
      [...sportsArray]
    );

    const processedStadiums = stadiums.map(stadium => {
      let images = [];
      try {
        images = JSON.parse(stadium.images || '[]');
      } catch (e) {
        // Silent error handling
      }

      return {
        ...stadium,
        images: images,
        description: stadium.description || null,
        sport_names: stadium.sport_names ? stadium.sport_names.split(',') : []
      };
    });

    res.status(200).json({ success: true, data: processedStadiums });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

module.exports = {
  addStadium,
  getStadiumsByCoachSports
};

