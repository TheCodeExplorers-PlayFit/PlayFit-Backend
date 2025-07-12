const {pool} = require('../config/db');

class StadiumModel {
  async createStadium({ name, address, google_maps_link, facilities, images, ownerId }) {
    const sql = `
      INSERT INTO stadiums (name, address, google_maps_link, facilities, images, owner_id, isVerified)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [
      name,
      address,
      google_maps_link,
      facilities || null,
      images.join(','),
      ownerId,
      0
    ]);
    return result.insertId;
  }

  async createStadiumSport(stadiumId, sportId, sportPercentage) {
    const sql = `
      INSERT INTO stadium_sports (stadium_id, sport_id, sport_percentage)
      VALUES (?, ?, ?)
    `;
    await pool.execute(sql, [stadiumId, sportId, sportPercentage]);
  }

  async createSession(stadiumId, sportId, dayNum, fromTime, toTime, maxPlayers, sportCost) {
    const sql = `
      INSERT INTO sessions (stadium_id, sport_id, coach_id, day_of_week, start_time, end_time, max_players, total_cost, stadium_sport_cost, coach_cost, isbooked, recurring, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await pool.execute(sql, [
      stadiumId,
      sportId,
      null,
      dayNum,
      fromTime,
      toTime,
      maxPlayers,
      0.00,
      sportCost,
      0.00,
      0,
      1,
      'available'
    ]);
  }

  async getSportId(sportName) {
    const [rows] = await pool.execute('SELECT id FROM sports WHERE name = ?', [sportName]);
    return rows.length > 0 ? rows[0].id : null;
  }

  async getStadiumsByOwner(ownerId) {
    const [rows] = await pool.execute(`
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
    `, [ownerId]);

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

    return Object.values(stadiums).map(stadium => ({
      ...stadium,
      schedule: stadium.schedule.filter(sched => sched.day && sched.fromTime && sched.toTime)
    }));
  }

  async updateStadium(id, ownerId, { name, address, google_maps_link, facilities, images }) {
    const sql = `
      UPDATE stadiums
      SET name = ?, address = ?, google_maps_link = ?, facilities = ?, images = ?
      WHERE id = ? AND owner_id = ?
    `;
    const [result] = await pool.execute(sql, [
      name,
      address,
      google_maps_link,
      facilities || null,
      images.join(','),
      id,
      ownerId
    ]);
    return result.affectedRows;
  }

  async deleteSessions(stadiumId) {
    await pool.execute('DELETE FROM sessions WHERE stadium_id = ?', [stadiumId]);
  }

  async deleteStadiumSports(stadiumId) {
    await pool.execute('DELETE FROM stadium_sports WHERE stadium_id = ?', [stadiumId]);
  }

  async deleteStadium(id, ownerId) {
    const sql = 'DELETE FROM stadiums WHERE id = ? AND owner_id = ?';
    const [result] = await pool.execute(sql, [id, ownerId]);
    return result.affectedRows;
  }

  async getStadiumsByCoachSports(userId) {
    const [coachSports] = await pool.execute(
      `SELECT sport1, sport2, sport3 FROM coach_details WHERE userId = ?`,
      [userId]
    );

    if (coachSports.length === 0) {
      throw new Error('Coach details not found');
    }

    const sportsArray = [
      coachSports[0].sport1,
      coachSports[0].sport2,
      coachSports[0].sport3
    ].filter(sport => sport !== null && sport !== 0);

    if (sportsArray.length === 0) {
      throw new Error('No valid sports found for this coach');
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

    return stadiums.map(stadium => ({
      ...stadium,
      images: stadium.images ? stadium.images.split(',') : [],
      description: stadium.description || null,
      sport_names: stadium.sport_names ? stadium.sport_names.split(',') : []
    }));
  }
}

module.exports = new StadiumModel();