const pool = require('../config/db');

async function addStadium(req, res) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { name, address, google_maps_link, facilities, images, schedule } = req.body;

    // Validate input
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

    // Insert into stadiums
    const sqlStadium = `
      INSERT INTO stadiums (name, address, google_maps_link, facilities, images, owner_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    let stadiumResult;
    try {
      [stadiumResult] = await connection.execute(sqlStadium, [
        name,
        address,
        google_maps_link,
        facilities || null,
        JSON.stringify(images),
        ownerId
      ]);
    } catch (error) {
      console.error('Error inserting stadium:', error);
      throw new Error(`Failed to insert stadium: ${error.message}`);
    }
    const stadiumId = stadiumResult.insertId;

    // Insert into stadium_sports
    const uniqueSports = [...new Set(schedule.map(session => session.sport))];
    for (const sport of uniqueSports) {
      const [sportRows] = await connection.execute('SELECT id FROM sports WHERE name = ?', [sport]);
      if (sportRows.length === 0) {
        console.warn(`Sport ${sport} not found. Skipping.`);
        continue;
      }
      const sportId = sportRows[0].id;
      try {
        await connection.execute('INSERT INTO stadium_sports (stadium_id, sport_id, sport_percentage) VALUES (?, ?, ?)', [
          stadiumId,
          sportId,
          0.00
        ]);
      } catch (error) {
        console.error(`Error inserting stadium_sports for sport ${sport}:`, error);
        throw new Error(`Failed to link sport ${sport}: ${error.message}`);
      }
    }

    // Insert into sessions
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const session of schedule) {
      const { sport, day, fromTime, toTime, maxPlayers } = session;

      // Validate session fields
      if (!sport || !day || !fromTime || !toTime || !Number.isInteger(maxPlayers) || maxPlayers <= 0) {
        throw new Error(`Invalid session data: ${JSON.stringify(session)}`);
      }
      if (fromTime >= toTime) {
        throw new Error(`Invalid time range for sport ${sport}: ${fromTime} to ${toTime}`);
      }

      const [sportRows] = await connection.execute('SELECT id FROM sports WHERE name = ?', [sport]);
      if (sportRows.length === 0) {
        console.warn(`Sport ${sport} not found. Skipping session.`);
        continue;
      }
      const sportId = sportRows[0].id;

      const dayIndex = daysOfWeek.indexOf(day);
      if (dayIndex === -1) {
        throw new Error(`Invalid day ${day} for sport ${sport}`);
      }

      const sqlSession = `
        INSERT INTO sessions (stadium_id, sport_id, start_time, end_time, max_players, status, day_of_week, recurring)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      try {
        await connection.execute(sqlSession, [
          stadiumId,
          sportId,
          fromTime,
          toTime,
          maxPlayers,
          'available',
          dayIndex + 1, // 1=Monday, ..., 7=Sunday
          1 // Recurring weekly
        ]);
      } catch (error) {
        console.error(`Error inserting session for sport ${sport}:`, error);
        throw new Error(`Failed to insert session for ${sport}: ${error.message}`);
      }
    }

    await connection.commit();
    res.status(201).json({ message: 'Stadium and sessions added successfully', stadiumId });
  } catch (error) {
    await connection.rollback();
    console.error('Error adding stadium:', error);
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
        console.warn(`Error parsing images for stadium ${stadium.id}:`, e);
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
    console.error('Error in getStadiumsByCoachSports:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

async function getStadiums(req, res) {
  console.log('getStadiums called with user:', req.user);
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(`
      SELECT s.id, s.name, s.address, s.google_maps_link, s.facilities, s.images,
             ss.sport_id, sp.name AS sport_name,
             se.session_date, se.start_time, se.end_time, se.max_players
      FROM stadiums s
      LEFT JOIN stadium_sports ss ON s.id = ss.stadium_id
      LEFT JOIN sports sp ON ss.sport_id = sp.id
      LEFT JOIN sessions se ON s.id = se.stadium_id
      WHERE s.owner_id = ?
    `, [req.user.id]);
    console.log('Database rows:', rows);
    const stadiums = {};
    rows.forEach(row => {
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
          if (row.images) {
            const parsedImages = JSON.parse(row.images);
            if (Array.isArray(parsedImages)) {
              stadiums[row.id].images = parsedImages;
            }
          }
        } catch (e) {
          console.warn(`Invalid JSON in images for stadium ${row.id}: ${row.images}`);
          stadiums[row.id].images = [];
        }
      }
      if (row.sport_name) {
        stadiums[row.id].schedules.push({
          sport: row.sport_name,
          session_date: row.session_date,
          start_time: row.start_time,
          end_time: row.end_time,
          max_players: row.max_players
        });
      }
    });
    res.status(200).json(Object.values(stadiums));
  } catch (error) {
    console.error('Error fetching stadiums:', error);
    res.status(500).json({ message: 'Error fetching stadiums', error: error.message });
  } finally {
    connection.release();
  }
}

async function updateStadium(req, res) {
  const connection = await pool.getConnection();
  try {
    const { id, name, address, google_maps_link, facilities, images, schedules } = req.body;
    console.log('Updating stadium with data:', req.body);
    await connection.beginTransaction();
    const sqlUpdate = `
      UPDATE stadiums
      SET name = ?, address = ?, google_maps_link = ?, facilities = ?, images = ?
      WHERE id = ? AND owner_id = ?
    `;
    await connection.execute(sqlUpdate, [
      name,
      address,
      google_maps_link,
      facilities,
      JSON.stringify(images || []),
      id,
      req.user.id
    ]);
    await connection.execute('DELETE FROM sessions WHERE stadium_id = ?', [id]);
    for (const schedule of schedules) {
      const [sportRows] = await connection.execute('SELECT id FROM sports WHERE name = ?', [schedule.sport]);
      if (sportRows.length > 0) {
        const sportId = sportRows[0].id;
        await connection.execute(
          'INSERT INTO sessions (stadium_id, sport_id, session_date, start_time, end_time, max_players, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, sportId, new Date().toISOString().split('T')[0], schedule.start_time, schedule.end_time, schedule.max_players, 'available']
        );
      }
    }
    await connection.commit();
    res.status(200).json({ message: 'Stadium updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating stadium:', error);
    res.status(500).json({ message: 'Error updating stadium', error: error.message });
  } finally {
    connection.release();
  }
}

async function deleteStadium(req, res) {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    console.log('Deleting stadium with id:', id);
    await connection.beginTransaction();
    await connection.execute('DELETE FROM sessions WHERE stadium_id = ?', [id]);
    await connection.execute('DELETE FROM stadium_sports WHERE stadium_id = ?', [id]);
    await connection.execute('DELETE FROM stadiums WHERE id = ? AND owner_id = ?', [id, req.user.id]);
    await connection.commit();
    res.status(200).json({ message: 'Stadium deleted successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error deleting stadium:', error);
    res.status(500).json({ message: 'Error deleting stadium', error: error.message });
  } finally {
    connection.release();
  }
}

module.exports = {
  addStadium,
  getStadiumsByCoachSports,
  getStadiums,
  updateStadium,
  deleteStadium
};