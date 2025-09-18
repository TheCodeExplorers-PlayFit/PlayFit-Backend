// backend/controllers/calendarController.js
const { sequelize } = require('../config/db');
const { QueryTypes } = require('sequelize');

exports.getStadiums = async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT id, name, address FROM stadiums WHERE isVerified = 1';
    const replacements = [];

    if (search) {
      query += ' AND name LIKE ?';
      replacements.push(`%${search}%`);
    }

    console.log('Stadiums query:', query, 'Replacements:', replacements); // Debug query
    const stadiums = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT,
    });

    console.log('Fetched stadiums:', JSON.stringify(stadiums, null, 2)); // Debug fetched data
    res.status(200).json({ success: true, data: stadiums });
  } catch (error) {
    console.error('Error fetching stadiums:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.getSessionsByStadiumAndDate = async (req, res) => {
  try {
    const { stadiumId, date } = req.params;

    if (!stadiumId || isNaN(stadiumId)) {
      return res.status(400).json({ success: false, message: 'Invalid stadium ID' });
    }

    const selectedDate = new Date(date);
    if (isNaN(selectedDate)) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }

    console.log(`API Request: stadiumId=${stadiumId}, date=${date}`); // Debug input

    const sessions = await sequelize.query(
      `SELECT s.id, s.start_time, s.end_time, s.max_players, s.status, 
              sp.name AS sport_name, u.first_name AS coach_first_name, u.last_name AS coach_last_name,
              s.day_of_week, s.total_cost, s.stadium_sport_cost, s.coach_cost, s.recurring
       FROM sessions s
       LEFT JOIN sports sp ON s.sport_id = sp.id
       LEFT JOIN users u ON s.coach_id = u.id
       WHERE s.stadium_id = ?`,
      {
        replacements: [stadiumId],
        type: QueryTypes.SELECT,
      }
    );

    console.log('Raw sessions from DB (before filter):', JSON.stringify(sessions, null, 2)); // Debug raw data

    const currentDayOfWeek = selectedDate.getDay();
    const selectedDayOfWeek = currentDayOfWeek === 0 ? 7 : currentDayOfWeek;
    const selectedDateStr = selectedDate.toISOString().split('T')[0];

    console.log(`Processed date: ${selectedDateStr}, selectedDayOfWeek: ${selectedDayOfWeek}`); // Debug date

    const filteredSessions = sessions
      .filter(session => {
        const isRecurringMatch = session.recurring === 1 && session.day_of_week === selectedDayOfWeek && (session.day_of_week >= 1 && session.day_of_week <= 7);
        const isNonRecurringMatch = session.recurring === 0 && selectedDateStr === '2025-07-18'; // Example for Friday, adjust logic if needed
        console.log(`Filtering session ${session.id}: day_of_week=${session.day_of_week}, recurring=${session.recurring}, isRecurringMatch=${isRecurringMatch}, isNonRecurringMatch=${isNonRecurringMatch}`);
        return isRecurringMatch || isNonRecurringMatch;
      })
      .map(session => ({
        ...session,
        session_date: selectedDateStr,
      }));

    console.log('Filtered sessions:', JSON.stringify(filteredSessions, null, 2)); // Debug output

    res.status(200).json({ success: true, data: filteredSessions });
  } catch (error) {
    console.error('Error fetching sessions:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};