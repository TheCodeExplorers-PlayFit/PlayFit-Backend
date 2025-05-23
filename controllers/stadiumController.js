const pool = require('../config/db');

async function addStadium(req, res) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { name, address, google_maps_link, facilities, images, schedule } = req.body;

    console.log('Received stadium data:', { name, address, google_maps_link, facilities, images, schedule });

    if (!name || !address || !google_maps_link || !schedule) {
      return res.status(400).json({ message: 'Missing required fields: name, address, google_maps_link, or schedule' });
    }

    if (!Array.isArray(schedule) || schedule.length === 0) {
      return res.status(400).json({ message: 'Schedule must be a non-empty array' });
    }

    for (const row of schedule) {
      if (typeof row.sportPercentage !== 'number' || row.sportPercentage < 0 || row.sportPercentage > 100) {
        return res.status(400).json({ message: `Invalid sportPercentage for sport ${row.sport}: must be a number between 0 and 100` });
      }
      if (!row.sport || !row.day || !row.fromTime || !row.toTime || typeof row.maxPlayers !== 'number' || row.maxPlayers <= 0) {
        return res.status(400).json({ message: `Invalid schedule for sport ${row.sport}: missing or invalid fields` });
      }
    }

    // Validate images (expecting Cloudinary URLs)
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ message: 'At least one image URL is required' });
    }
    const imagePaths = images.join(','); // Store as comma-separated string

    const ownerId = req.user.id;

    const sqlStadium = `
      INSERT INTO stadiums (name, address, google_maps_link, facilities, images, owner_id, isVerified)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const [stadiumResult] = await connection.execute(sqlStadium, [
      name,
      address,
      google_maps_link,
      facilities || null,
      imagePaths,
      ownerId,
      0
    ]);
    const stadiumId = stadiumResult.insertId;

    const sportsMap = new Map();
    schedule.forEach(row => {
      const sport = row.sport;
      if (!sportsMap.has(sport)) {
        const normalizedPercentage = row.sportPercentage / 100;
        sportsMap.set(sport, {
          sport,
          sportPercentage: normalizedPercentage,
          sportCost: normalizedPercentage,
          schedule: []
        });
      }
      sportsMap.get(sport).schedule.push({
        day: row.day,
        fromTime: row.fromTime,
        toTime: row.toTime,
        maxPlayers: row.maxPlayers
      });
    });
    const parsedSports = Array.from(sportsMap.values());

    for (const sportEntry of parsedSports) {
      const { sport, sportPercentage, sportCost, schedule } = sportEntry;
      const [sportRows] = await connection.execute('SELECT id FROM sports WHERE name = ?', [sport]);
      if (sportRows.length === 0) {
        console.warn(`Sport ${sport} not found. Skipping.`);
        continue;
      }
      const sportId = sportRows[0].id;

      await connection.execute(
        'INSERT INTO stadium_sports (stadium_id, sport_id, sport_percentage) VALUES (?, ?, ?)',
        [stadiumId, sportId, sportPercentage]
      );

      for (const sched of schedule) {
        const { day, fromTime, toTime, maxPlayers } = sched;
        const dayToInt = {
          'Monday': 1,
          'Tuesday': 2,
          'Wednesday': 3,
          'Thursday': 4,
          'Friday': 5,
          'Saturday': 6,
          'Sunday': 7
        };
        const dayNum = dayToInt[day];
        if (!dayNum) {
          console.warn(`Invalid day for sport ${sport}: ${day}`);
          continue;
        }

        const sqlSession = `
          INSERT INTO sessions (stadium_id, sport_id, coach_id, day_of_week, start_time, end_time, max_players, total_cost, stadium_sport_cost, coach_cost, isbooked, recurring, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await connection.execute(sqlSession, [
          stadiumId,
          sportId,
          null,
          dayNum,
          fromTime,
          toTime,
          maxPlayers,
          0.00,
          sportCost || sportPercentage,
          0.00,
          0,
          1,
          'available'
        ]);
      }
    }

    await connection.commit();
    res.status(201).json({ message: 'Stadium and sessions added successfully', stadiumId });
  } catch (error) {
    await connection.rollback();
    console.error('Error adding stadium:', error);
    if (error.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      return res.status(400).json({ message: 'Invalid data: sport_percentage must be between 0 and 1' });
    }
    res.status(500).json({ message: 'Error adding stadium', error: error.message });
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
        images = stadium.images ? stadium.images.split(',') : [];
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
      SELECT 
        s.id, s.name, s.address, s.google_maps_link, s.facilities, s.description, s.details, s.images,
        ss.sport_id, sp.name AS sport_name, ss.sport_percentage,
        se.id AS session_id, se.day_of_week, se.start_time, se.end_time, se.max_players, se.stadium_sport_cost
      FROM stadiums s
      LEFT JOIN stadium_sports ss ON s.id = ss.stadium_id
      LEFT JOIN sports sp ON ss.sport_id = sp.id
      LEFT JOIN sessions se ON s.id = se.stadium_id AND ss.sport_id = se.sport_id
      WHERE s.owner_id = ?
      ORDER BY s.id, ss.sport_id, se.day_of_week
    `, [req.user.id]);
    console.log('Raw database rows:', rows);

    const intToDay = {
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday',
      7: 'Sunday'
    };

    const stadiums = {};
    rows.forEach(row => {
      if (!stadiums[row.id]) {
        stadiums[row.id] = {
          id: row.id,
          name: row.name,
          address: row.address,
          google_maps_link: row.google_maps_link,
          facilities: row.facilities || null,
          description: row.description || null,
          details: row.details || null,
          images: row.images ? row.images.split(',') : [],
          schedule: []
        };
      }

      if (row.sport_name && !stadiums[row.id].schedule.some(sched => sched.sport === row.sport_name)) {
        const schedEntry = {
          sport: row.sport_name,
          sportPercentage: row.sport_percentage * 100,
          maxPlayers: row.max_players || 0,
          day: '',
          fromTime: '',
          toTime: ''
        };
        stadiums[row.id].schedule.push(schedEntry);
      }

      if (row.sport_name && row.session_id) {
        const schedEntry = stadiums[row.id].schedule.find(sched => sched.sport === row.sport_name);
        if (schedEntry) {
          schedEntry.day = intToDay[row.day_of_week] || row.day_of_week.toString();
          schedEntry.fromTime = row.start_time;
          schedEntry.toTime = row.end_time;
          schedEntry.maxPlayers = row.max_players;
        }
      }
    });

    const result = Object.values(stadiums).map(stadium => ({
      ...stadium,
      schedule: stadium.schedule.filter(sched => sched.day && sched.fromTime && sched.toTime)
    }));
    console.log('Processed stadiums response:', result);
    res.status(200).json(result);
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
    const { id, name, address, google_maps_link, facilities, images, schedule } = req.body;
    console.log('Updating stadium with data:', { id, name, address, google_maps_link, facilities, images, schedule });

    if (!id || !name || !address || !google_maps_link || !schedule || !Array.isArray(schedule)) {
      return res.status(400).json({ message: 'Missing required fields: id, name, address, google_maps_link, or schedule' });
    }

    for (const row of schedule) {
      if (typeof row.sportPercentage !== 'number' || row.sportPercentage < 0 || row.sportPercentage > 100) {
        return res.status(400).json({ message: `Invalid sportPercentage for sport ${row.sport}: must be a number between 0 and 100` });
      }
      if (!row.sport || !row.day || !row.fromTime || !row.toTime || typeof row.maxPlayers !== 'number' || row.maxPlayers <= 0) {
        return res.status(400).json({ message: `Invalid schedule for sport ${row.sport}: missing or invalid fields` });
      }
    }

    await connection.beginTransaction();

    const imagePaths = Array.isArray(images) ? images.join(',') : images; // Store as comma-separated string

    const sqlUpdate = `
      UPDATE stadiums
      SET name = ?, address = ?, google_maps_link = ?, facilities = ?, images = ?
      WHERE id = ? AND owner_id = ?
    `;
    const [updateResult] = await connection.execute(sqlUpdate, [
      name,
      address,
      google_maps_link,
      facilities || null,
      imagePaths || '',
      id,
      req.user.id
    ]);

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Stadium not found or you do not have permission to update it' });
    }

    await connection.execute('DELETE FROM sessions WHERE stadium_id = ?', [id]);
    await connection.execute('DELETE FROM stadium_sports WHERE stadium_id = ?', [id]);

    const sportsMap = new Map();
    schedule.forEach(row => {
      const sport = row.sport;
      if (!sportsMap.has(sport)) {
        const normalizedPercentage = row.sportPercentage / 100;
        sportsMap.set(sport, {
          sport,
          sportPercentage: normalizedPercentage,
          sportCost: normalizedPercentage,
          schedule: []
        });
      }
      sportsMap.get(sport).schedule.push({
        day: row.day,
        fromTime: row.fromTime,
        toTime: row.toTime,
        maxPlayers: row.maxPlayers
      });
    });
    const parsedSports = Array.from(sportsMap.values());

    for (const sportEntry of parsedSports) {
      const { sport, sportPercentage, sportCost, schedule } = sportEntry;
      const [sportRows] = await connection.execute('SELECT id FROM sports WHERE name = ?', [sport]);
      if (sportRows.length === 0) {
        console.warn(`Sport ${sport} not found. Skipping.`);
        continue;
      }
      const sportId = sportRows[0].id;

      console.log('Inserting stadium_sports:', { stadiumId: id, sportId, sportPercentage });
      await connection.execute(
        'INSERT INTO stadium_sports (stadium_id, sport_id, sport_percentage) VALUES (?, ?, ?)',
        [id, sportId, sportPercentage]
      );

      for (const sched of schedule) {
        const { day, fromTime, toTime, maxPlayers } = sched;
        const dayToInt = {
          'Monday': 1,
          'Tuesday': 2,
          'Wednesday': 3,
          'Thursday': 4,
          'Friday': 5,
          'Saturday': 6,
          'Sunday': 7
        };
        const dayNum = dayToInt[day];
        if (!dayNum) {
          console.warn(`Invalid day for sport ${sport}: ${day}`);
          continue;
        }

        console.log('Inserting session:', { stadiumId: id, sportId, dayNum, fromTime, toTime, maxPlayers });
        const sqlSession = `
          INSERT INTO sessions (stadium_id, sport_id, coach_id, day_of_week, start_time, end_time, max_players, total_cost, stadium_sport_cost, coach_cost, isbooked, recurring, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await connection.execute(sqlSession, [
          id,
          sportId,
          null,
          dayNum,
          fromTime,
          toTime,
          maxPlayers,
          0.00,
          sportCost || sportPercentage,
          0.00,
          0,
          1,
          'available'
        ]);
      }
    }

    await connection.commit();
    res.status(200).json({ message: 'Stadium updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating stadium:', error);
    if (error.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      return res.status(400).json({ message: 'Invalid data: sport_percentage must be between 0 and 1' });
    }
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