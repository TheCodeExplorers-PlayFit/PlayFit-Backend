const { pool } = require('../config/db');
const StadiumModel = require('../models/StadiumModel');

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
      if (typeof row.sportCost !== 'number' || isNaN(row.sportCost) || row.sportCost < 0 || row.sportCost > 1000) {
        console.log(`Invalid sportCost for sport ${row.sport}:`, row.sportCost);
        return res.status(400).json({ message: `Invalid sportCost for sport ${row.sport}: must be between 0 and 1000 Rs` });
      }
      if (!row.sport || !row.day || !row.fromTime || !row.toTime || typeof row.maxPlayers !== 'number' || row.maxPlayers <= 0) {
        return res.status(400).json({ message: `Invalid schedule for sport ${row.sport}: missing or invalid fields` });
      }
    }

    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ message: 'At least one image URL is required' });
    }

    const ownerId = req.user.id;
    const stadiumId = await StadiumModel.createStadium({
      name,
      address,
      google_maps_link,
      facilities,
      images,
      ownerId
    });

    const sportsMap = new Map();
    schedule.forEach(row => {
      const sport = row.sport;
      if (!sportsMap.has(sport)) {
        sportsMap.set(sport, {
          sport,
          sportCost: row.sportCost,
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

    const dayToInt = {
      'Monday': 1,
      'Tuesday': 2,
      'Wednesday': 3,
      'Thursday': 4,
      'Friday': 5,
      'Saturday': 6,
      'Sunday': 7
    };

    for (const sportEntry of parsedSports) {
      const { sport, sportCost, schedule } = sportEntry;
      const sportId = await StadiumModel.getSportId(sport);
      if (!sportId) {
        console.warn(`Sport ${sport} not found. Skipping.`);
        continue;
      }

      await StadiumModel.createStadiumSport(stadiumId, sportId, sportCost);

      for (const sched of schedule) {
        const { day, fromTime, toTime, maxPlayers } = sched;
        const dayNum = dayToInt[day];
        if (!dayNum) {
          console.warn(`Invalid day for sport ${sport}: ${day}`);
          continue;
        }

        await StadiumModel.createSession(stadiumId, sportId, dayNum, fromTime, toTime, maxPlayers, sportCost);
      }
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

async function getStadiumsByCoachSports(req, res) {
  try {
    if (req.user.role !== 'coach') {
      return res.status(403).json({ success: false, message: 'Only coaches can access this resource' });
    }

    const stadiums = await StadiumModel.getStadiumsByCoachSports(req.user.id);
    res.status(200).json({ success: true, data: stadiums });
  } catch (error) {
    console.error('Error in getStadiumsByCoachSports:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

async function getStadiums(req, res) {
  try {
    const stadiums = await StadiumModel.getStadiumsByOwner(req.user.id);
    console.log('Processed stadiums response:', stadiums);
    res.status(200).json(stadiums);
  } catch (error) {
    console.error('Error fetching stadiums:', error);
    res.status(500).json({ message: 'Error fetching stadiums', error: error.message });
  }
}

async function updateStadium(req, res) {
  const connection = await pool.getConnection();

  try {
    const { id, name, address, google_maps_link, facilities, images, schedule } = req.body;
    console.log('Received update request body:', JSON.stringify(req.body, null, 2));

    if (!id || !name || !address || !google_maps_link || !schedule || !Array.isArray(schedule)) {
      return res.status(400).json({ message: 'Missing required fields: id, name, address, google_maps_link, or schedule' });
    }

    for (const row of schedule) {
      if (typeof row.sportCost !== 'number' || isNaN(row.sportCost) || row.sportCost < 0 || row.sportCost > 1000) {
        console.log(`Invalid sportCost for sport ${row.sport}:`, row.sportCost);
        return res.status(400).json({ message: `Invalid sportCost for sport ${row.sport}: must be between 0 and 1000 Rs` });
      }
      if (!row.sport || !row.day || !row.fromTime || !row.toTime || typeof row.maxPlayers !== 'number' || row.maxPlayers <= 0) {
        return res.status(400).json({ message: `Invalid schedule for sport ${row.sport}: missing or invalid fields` });
      }
    }

    await connection.beginTransaction();

    const affectedRows = await StadiumModel.updateStadium(id, req.user.id, {
      name,
      address,
      google_maps_link,
      facilities,
      images
    });

    if (affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Stadium not found or you do not have permission to update it' });
    }

    await StadiumModel.deleteSessions(id);
    await StadiumModel.deleteStadiumSports(id);

    const sportsMap = new Map();
    schedule.forEach(row => {
      const sport = row.sport;
      if (!sportsMap.has(sport)) {
        sportsMap.set(sport, {
          sport,
          sportCost: row.sportCost,
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

    const dayToInt = {
      'Monday': 1,
      'Tuesday': 2,
      'Wednesday': 3,
      'Thursday': 4,
      'Friday': 5,
      'Saturday': 6,
      'Sunday': 7
    };

    for (const sportEntry of parsedSports) {
      const { sport, sportCost, schedule } = sportEntry;
      const sportId = await StadiumModel.getSportId(sport);
      if (!sportId) {
        console.warn(`Sport ${sport} not found. Skipping.`);
        continue;
      }

      await StadiumModel.createStadiumSport(id, sportId, sportCost);

      for (const sched of schedule) {
        const { day, fromTime, toTime, maxPlayers } = sched;
        const dayNum = dayToInt[day];
        if (!dayNum) {
          console.warn(`Invalid day for sport ${sport}: ${day}`);
          continue;
        }

        await StadiumModel.createSession(id, sportId, dayNum, fromTime, toTime, maxPlayers, sportCost);
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

    await StadiumModel.deleteSessions(id);
    await StadiumModel.deleteStadiumSports(id);
    const affectedRows = await StadiumModel.deleteStadium(id, req.user.id);

    if (affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Stadium not found or you do not have permission to delete it' });
    }

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