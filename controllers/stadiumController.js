const pool = require('../config/db');

async function addStadium(req, res) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { name, address, google_maps_link, facilities, images, schedule } = req.body;

    if (!name || !address || !google_maps_link || !schedule || !Array.isArray(schedule) || schedule.length === 0) {
      return res.status(400).json({ message: 'Missing required fields: name, address, google_maps_link, or valid schedule' });
    }
    if (!Array.isArray(images)) {
      return res.status(400).json({ message: 'Images must be an array' });
    }

    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const sqlStadium = 'INSERT INTO stadiums (name, address, google_maps_link, facilities, images, owner_id) VALUES (?, ?, ?, ?, ?, ?)';
    const [stadiumResult] = await connection.execute(sqlStadium, [
      name,
      address,
      google_maps_link,
      facilities || null,
      JSON.stringify(images),
      ownerId
    ]);
    const stadiumId = stadiumResult.insertId;

    const uniqueSports = [...new Set(schedule.map(session => session.sport))];
    for (const sport of uniqueSports) {
      const [sportRows] = await connection.execute('SELECT id FROM sports WHERE name = ?', [sport]);
      if (sportRows.length === 0) continue;
      const sportId = sportRows[0].id;
      await connection.execute('INSERT INTO stadium_sports (stadium_id, sport_id, sport_percentage) VALUES (?, ?, ?)', [
        stadiumId,
        sportId,
        0.00
      ]);
    }

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const session of schedule) {
      const { sport, day, fromTime, toTime, maxPlayers, sportPercentage } = session;
      if (!sport || !day || !fromTime || !toTime || !Number.isInteger(maxPlayers) || maxPlayers <= 0 || fromTime >= toTime || sportPercentage === undefined || sportPercentage < 0 || sportPercentage > 100) {
        continue;
      }

      const [sportRows] = await connection.execute('SELECT id FROM sports WHERE name = ?', [sport]);
      if (sportRows.length === 0) continue;
      const sportId = sportRows[0].id;

      const dayIndex = daysOfWeek.indexOf(day);
      if (dayIndex === -1) continue;

      const sqlSession = 'INSERT INTO sessions (stadium_id, sport_id, start_time, end_time, max_players, status, day_of_week, recurring, stadium_sport_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
      await connection.execute(sqlSession, [
        stadiumId,
        sportId,
        fromTime,
        toTime,
        maxPlayers,
        'available',
        dayIndex + 1,
        1,
        (sportPercentage / 100).toFixed(2)
      ]);
    }

    await connection.commit();
    res.status(201).json({ message: 'Stadium and sessions added successfully', stadiumId });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: 'Failed to add stadium', error: error.message });
  } finally {
    connection.release();
  }
}

async function getStadiumsByCoachSports(req, res) {
  try {
    const userId = req.user.id;
    if (req.user.role !== 'coach') {
      return res.status(403).json({ success: false, message: 'Only coaches can access this resource' });
    }

    const [coachSports] = await pool.execute('SELECT sport1, sport2, sport3 FROM coach_details WHERE userId = ?', [userId]);
    if (coachSports.length === 0) {
      return res.status(404).json({ success: false, message: 'Coach details not found' });
    }

    const sportsArray = [coachSports[0].sport1, coachSports[0].sport2, coachSports[0].sport3].filter(sport => sport);
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
      sportsArray
    );

    const processedStadiums = stadiums.map(stadium => {
      let images = [];
      try { images = JSON.parse(stadium.images || '[]'); } catch (e) {}
      return {
        ...stadium,
        images,
        description: stadium.description || null,
        sport_names: stadium.sport_names ? stadium.sport_names.split(',') : []
      };
    });

    res.status(200).json({ success: true, data: processedStadiums });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

async function getStadiums(req, res) {
  const connection = await pool.getConnection();
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const sqlQuery = `
      SELECT s.id, s.name, s.address, s.google_maps_link, s.facilities, s.images,
             ss.sport_id, sp.name AS sport_name,
             se.start_time, se.end_time, se.max_players, se.day_of_week, se.stadium_sport_cost
      FROM stadiums s
      LEFT JOIN stadium_sports ss ON s.id = ss.stadium_id
      LEFT JOIN sports sp ON ss.sport_id = sp.id
      LEFT JOIN sessions se ON s.id = se.stadium_id 
        AND (se.sport_id = ss.sport_id OR se.sport_id IS NULL)
        AND se.status = 'available'
      WHERE s.owner_id = ?
    `;
    const [rows] = await connection.execute(sqlQuery, [req.user.id]);

    const stadiums = {};
    for (const row of rows) {
      if (!stadiums[row.id]) {
        stadiums[row.id] = {
          id: row.id,
          name: row.name,
          address: row.address,
          google_maps_link: row.google_maps_link,
          facilities: row.facilities,
          images: [],
          schedules: []
        };
        try {
          stadiums[row.id].images = JSON.parse(row.images || '[]');
        } catch {}
      }
      if (row.sport_name && row.start_time && row.end_time && row.max_players && row.day_of_week) {
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const day = daysOfWeek[row.day_of_week - 1];
        stadiums[row.id].schedules.push({
          sport: row.sport_name,
          day,
          start_time: row.start_time,
          end_time: row.end_time,
          max_players: row.max_players,
          stadium_sportcost: parseFloat(row.stadium_sport_cost) * 100
        });
      }
    }

    res.status(200).json(Object.values(stadiums));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stadiums', error: error.message });
  } finally {
    connection.release();
  }
}

module.exports = {
  addStadium,
  getStadiums,
  getStadiumsByCoachSports
};