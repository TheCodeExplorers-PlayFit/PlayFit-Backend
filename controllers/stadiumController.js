const pool = require('../config/db');

// =================== Add Stadium ===================
async function addStadium(req, res) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { name, address, google_maps_link, facilities, images, schedule } = req.body;

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

    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ message: 'At least one image URL is required' });
    }
    const imagePaths = images.join(',');

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

// =================== Get Stadiums By Coach's Sports ===================
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

// Other functions (getStadiums, updateStadium, deleteStadium) remain unchanged...
// You can paste them here in the same format if needed.

module.exports = {
  addStadium,
  getStadiumsByCoachSports,
  getStadiums,
  updateStadium,
  deleteStadium
};
