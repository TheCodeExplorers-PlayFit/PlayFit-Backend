const { sequelize } = require('../config/db');
const { QueryTypes } = require('sequelize');

class PrivateSessionsController {
  // Create a private session (Coach)
  async createPrivateSession(req, res) {
    try {
      const { stadium_id, sport_id, start_time, end_time, date, cost } = req.body;
      const coach_id = req.user.id;

      // Validate coach's sport
      const coachSports = await sequelize.query(
        `SELECT sport1, sport2, sport3 FROM coach_details WHERE userId = ?`,
        { replacements: [coach_id], type: QueryTypes.SELECT }
      );
      if (!coachSports.length || ![coachSports[0].sport1, coachSports[0].sport2, coachSports[0].sport3].includes(Number(sport_id))) {
        return res.status(400).json({ success: false, message: 'Invalid sport for this coach' });
      }

      // Validate stadium
      const stadium = await sequelize.query(
        `SELECT id FROM stadiums WHERE id = ?`,
        { replacements: [stadium_id], type: QueryTypes.SELECT }
      );
      if (!stadium.length) {
        return res.status(400).json({ success: false, message: 'Invalid stadium' });
      }

      // Create private session
      const [session] = await sequelize.query(
        `INSERT INTO private_sessions (coach_id, stadium_id, sport_id, start_time, end_time, date, cost, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'not_asked')`,
        { replacements: [coach_id, stadium_id, sport_id, start_time, end_time, date, cost], type: QueryTypes.INSERT }
      );

      res.status(201).json({ success: true, message: 'Private session created successfully', sessionId: session });
    } catch (error) {
      console.error('Error creating private session:', error);
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }

  // Get private sessions created by coach
  async getCoachPrivateSessions(req, res) {
    try {
      const coach_id = req.user.id;
      const sessions = await sequelize.query(
        `SELECT ps.id, ps.stadium_id, s.name as stadium_name, ps.sport_id, sp.name as sport_name, 
                ps.start_time, ps.end_time, ps.date, ps.cost, ps.status, u.first_name, u.last_name
         FROM private_sessions ps
         LEFT JOIN users u ON ps.player_id = u.id
         JOIN stadiums s ON ps.stadium_id = s.id
         JOIN sports sp ON ps.sport_id = sp.id
         WHERE ps.coach_id = ?`,
        { replacements: [coach_id], type: QueryTypes.SELECT }
      );

      res.status(200).json({ success: true, sessions });
    } catch (error) {
      console.error('Error fetching coach private sessions:', error);
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }

  // Get available private sessions for players (not booked)
  async getAvailablePrivateSessions(req, res) {
  try {
    const player_id = req.user.id;

    const sessions = await sequelize.query(
      `SELECT ps.id, ps.coach_id, u.first_name as coach_first_name, u.last_name as coach_last_name, 
              ps.stadium_id, s.name as stadium_name, ps.sport_id, sp.name as sport_name, 
              ps.start_time, ps.end_time, ps.date, ps.cost, ps.status
       FROM private_sessions ps
       JOIN users u ON ps.coach_id = u.id
       JOIN stadiums s ON ps.stadium_id = s.id
       JOIN sports sp ON ps.sport_id = sp.id
       WHERE ps.player_id IS NULL OR ps.player_id = ?`,
      { replacements: [player_id], type: QueryTypes.SELECT }
    );

    res.status(200).json({ success: true, sessions });
  } catch (error) {
    console.error('Error fetching available private sessions:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}


  // Request a private session (Player)
  async requestPrivateSession(req, res) {
    try {
      const { session_id } = req.body;
      const player_id = req.user.id;

      // Check session exists and is not booked
      const [session] = await sequelize.query(
        `SELECT status, player_id FROM private_sessions WHERE id = ?`,
        { replacements: [session_id], type: QueryTypes.SELECT }
      );
      if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
      }
      if (session.status === 'booked') {
        return res.status(400).json({ success: false, message: 'Session already booked' });
      }

      // Update session to include player_id and set status to 'asked'
      await sequelize.query(
        `UPDATE private_sessions SET player_id = ?, status = 'asked' WHERE id = ?`,
        { replacements: [player_id, session_id], type: QueryTypes.UPDATE }
      );

      res.status(200).json({ success: true, message: 'Session requested successfully' });
    } catch (error) {
      console.error('Error requesting private session:', error);
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }

  // Accept a private session request (Coach)
  async acceptPrivateSession(req, res) {
    try {
      const { session_id } = req.body;
      const coach_id = req.user.id;

      // Check session exists and belongs to coach
      const [session] = await sequelize.query(
        `SELECT status, coach_id FROM private_sessions WHERE id = ?`,
        { replacements: [session_id], type: QueryTypes.SELECT }
      );
      if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
      }
      if (session.coach_id !== coach_id) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }
      if (session.status === 'booked') {
        return res.status(400).json({ success: false, message: 'Session already booked by another player' });
      }

      // Update session to 'booked'
      await sequelize.query(
        `UPDATE private_sessions SET status = 'booked' WHERE id = ?`,
        { replacements: [session_id], type: QueryTypes.UPDATE }
      );

      res.status(200).json({ success: true, message: 'Session request accepted' });
    } catch (error) {
      console.error('Error accepting private session:', error);
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }

  // Reject a private session request (Coach)
  async rejectPrivateSession(req, res) {
    try {
      const { session_id } = req.body;
      const coach_id = req.user.id;

      // Check session exists and belongs to coach
      const [session] = await sequelize.query(
        `SELECT status, coach_id, player_id FROM private_sessions WHERE id = ?`,
        { replacements: [session_id], type: QueryTypes.SELECT }
      );
      if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
      }
      if (session.coach_id !== coach_id) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      // Reset player_id and status to 'not_asked'
      await sequelize.query(
        `UPDATE private_sessions SET player_id = NULL, status = 'not_asked' WHERE id = ?`,
        { replacements: [session_id], type: QueryTypes.UPDATE }
      );

      res.status(200).json({ success: true, message: 'Session request rejected' });
    } catch (error) {
      console.error('Error rejecting private session:', error);
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }

  // Search stadiums for private session creation
  async searchStadiums(req, res) {
    try {
      const { query } = req.query;
      const searchQuery = `%${query}%`;
      const stadiums = await sequelize.query(
        `SELECT id, name, address FROM stadiums WHERE name LIKE ? OR address LIKE ?`,
        { replacements: [searchQuery, searchQuery], type: QueryTypes.SELECT }
      );

      res.status(200).json({ success: true, stadiums });
    } catch (error) {
      console.error('Error searching stadiums:', error);
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }

  // Get coach's sports
  async getCoachSports(req, res) {
    try {
      const coach_id = req.user.id;
      const sports = await sequelize.query(
        `SELECT s.id, s.name 
         FROM sports s
         WHERE s.id IN (
           SELECT sport1 FROM coach_details WHERE userId = ?
           UNION
           SELECT sport2 FROM coach_details WHERE userId = ?
           UNION
           SELECT sport3 FROM coach_details WHERE userId = ?
         ) AND s.id IS NOT NULL`,
        { replacements: [coach_id, coach_id, coach_id], type: QueryTypes.SELECT }
      );

      res.status(200).json({ success: true, sports });
    } catch (error) {
      console.error('Error fetching coach sports:', error);
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }
}

module.exports = new PrivateSessionsController();