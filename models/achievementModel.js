
const { pool } = require('../config/db');

class AchievementModel {
  static async getAchievements(req) {
    try {
      const userRole = req.user?.role || 'guest';
      const userId = req.user?.id || null;
      let query = `
        SELECT 
          (COALESCE((SELECT COUNT(*) FROM player_bookings), 0) + 
           COALESCE((SELECT COUNT(*) FROM sessions WHERE coach_id IS NOT NULL), 0)) as totalUnlocked,
          (SELECT first_name FROM users u 
           JOIN (
             SELECT user_id, SUM(COALESCE(player_points, 0) + COALESCE(coach_points, 0)) as maxPoints 
             FROM (
               SELECT pb.player_id as user_id, COUNT(pb.id) * 10 as player_points, 0 as coach_points 
               FROM player_bookings pb
               GROUP BY pb.player_id
               UNION ALL
               SELECT s.coach_id as user_id, 0 as player_points, COUNT(s.id) * 10 as coach_points 
               FROM sessions s
               GROUP BY s.coach_id
             ) bookings 
             GROUP BY user_id
           ) b ON u.id = b.user_id 
           ORDER BY b.maxPoints DESC 
           LIMIT 1) as topAchiever,
          (SELECT role FROM users u 
           JOIN (
             SELECT user_id, SUM(COALESCE(player_points, 0) + COALESCE(coach_points, 0)) as maxPoints 
             FROM (
               SELECT pb.player_id as user_id, COUNT(pb.id) * 10 as player_points, 0 as coach_points 
               FROM player_bookings pb
               GROUP BY pb.player_id
               UNION ALL
               SELECT s.coach_id as user_id, 0 as player_points, COUNT(s.id) * 10 as coach_points 
               FROM sessions s
               GROUP BY s.coach_id
             ) bookings 
             GROUP BY user_id
           ) b ON u.id = b.user_id 
           ORDER BY b.maxPoints DESC 
           LIMIT 1) as mostActiveModule,
          (SELECT status FROM users u 
           JOIN (
             SELECT user_id, SUM(COALESCE(player_points, 0) + COALESCE(coach_points, 0)) as maxPoints 
             FROM (
               SELECT pb.player_id as user_id, COUNT(pb.id) * 10 as player_points, 0 as coach_points 
               FROM player_bookings pb
               GROUP BY pb.player_id
               UNION ALL
               SELECT s.coach_id as user_id, 0 as player_points, COUNT(s.id) * 10 as coach_points 
               FROM sessions s
               GROUP BY s.coach_id
             ) bookings 
             GROUP BY user_id
           ) b ON u.id = b.user_id 
           ORDER BY b.maxPoints DESC 
           LIMIT 1) as mostRecent
        FROM users u
        LEFT JOIN player_bookings pb ON u.id = pb.player_id AND u.role = 'player'
        LEFT JOIN sessions se ON u.id = se.coach_id AND u.role = 'coach'
        WHERE u.role IN ('player', 'coach')
      `;
      if (userRole === 'stadiumOwner' && userId) {
        query += ` AND EXISTS (
          SELECT 1 FROM stadiums s WHERE s.owner_id = ? AND s.id = COALESCE(pb.session_id, se.stadium_id)
        )`;
      }
      const [rows] = await pool.query(query, userRole === 'stadiumOwner' && userId ? [userId] : []);
      return rows[0] || { totalUnlocked: 0, topAchiever: 'N/A', mostActiveModule: 'N/A', mostRecent: 'N/A' };
    } catch (error) {
      console.error('Model error:', error);
      throw error;
    }
  }

  static async getAchievementDetails(req) {
    try {
      const userRole = req.user?.role || 'guest';
      const userId = req.user?.id || null;
      let query = `
        SELECT 
          (@row_number := @row_number + 1) AS unique_id,
          u.id AS user_id,
          u.first_name AS topAchiever,
          COALESCE(
            (SELECT s.name FROM stadiums s 
             JOIN (
               SELECT stadium_id FROM sessions se 
               WHERE se.coach_id = u.id AND se.id = (
                 SELECT MAX(id) FROM sessions WHERE coach_id = u.id
               )
               UNION
               SELECT stadium_id FROM sessions se 
               JOIN player_bookings pb ON se.id = pb.session_id 
               WHERE pb.player_id = u.id AND se.id = (
                 SELECT MAX(pb.session_id) FROM player_bookings WHERE player_id = u.id
               )
               LIMIT 1
             ) AS sub ON s.id = sub.stadium_id),
            'N/A'
          ) AS stadiumName,
          MAX(COALESCE(pb.booking_date, se.start_time)) AS dateEarned,
          u.role AS userType,
          COALESCE(
            (SELECT COUNT(*) FROM player_bookings pb2 WHERE pb2.player_id = u.id),
            0
          ) + COALESCE(
            (SELECT COUNT(*) FROM sessions se2 WHERE se2.coach_id = u.id),
            0
          ) AS sessionsCount,
          COALESCE(
            (SELECT COUNT(*) * 10 FROM player_bookings pb2 WHERE pb2.player_id = u.id),
            0
          ) + COALESCE(
            (SELECT COUNT(*) * 10 FROM sessions se2 WHERE se2.coach_id = u.id),
            0
          ) AS points
        FROM users u
        LEFT JOIN player_bookings pb ON u.id = pb.player_id AND u.role = 'player'
        LEFT JOIN sessions se ON u.id = se.coach_id AND u.role = 'coach'
        LEFT JOIN stadiums s ON s.id = COALESCE(pb.session_id, se.stadium_id),
        (SELECT @row_number := 0) AS init
        WHERE u.role IN ('player', 'coach') AND (
          EXISTS (SELECT 1 FROM player_bookings pb2 WHERE pb2.player_id = u.id) OR
          EXISTS (SELECT 1 FROM sessions se2 WHERE se2.coach_id = u.id)
        ) AND u.first_name IS NOT NULL
        GROUP BY u.id, u.first_name, u.role
        ORDER BY points DESC
      `;
      if (userRole === 'stadiumOwner' && userId) {
        query += ` AND s.owner_id = ?`;
      }
      console.log('Executing query:', query);
      const [rows] = await pool.query(query, userRole === 'stadiumOwner' && userId ? [userId] : []);
      console.log('Query result:', rows);
      return rows.map((row) => ({ ...row, id: row.unique_id }));
    } catch (error) {
      console.error('Model error:', error);
      throw error;
    }
  }

  static async getTopAchieversByStadium(req) {
    try {
      const query = `
        SELECT 
          (@row_number := @row_number + 1) AS unique_id,
          s.id AS stadium_id,
          s.name AS stadiumName,
          u.id AS user_id,
          u.first_name AS topAchiever,
          u.role AS userType,
          (COALESCE(
            (SELECT COUNT(*) * 10 FROM player_bookings pb 
             JOIN sessions s2 ON pb.session_id = s2.id 
             WHERE pb.player_id = u.id AND s2.stadium_id = s.id),
            0
          ) + COALESCE(
            (SELECT COUNT(*) * 10 FROM sessions se 
             WHERE se.coach_id = u.id AND se.stadium_id = s.id),
            0
          )) AS points
        FROM stadiums s
        JOIN users u ON u.id IN (
          SELECT player_id FROM player_bookings pb 
          JOIN sessions s2 ON pb.session_id = s2.id
          WHERE s2.stadium_id = s.id
          UNION
          SELECT coach_id FROM sessions WHERE stadium_id = s.id
        ),
        (SELECT @row_number := 0) AS init
        GROUP BY s.id, s.name, u.id, u.first_name, u.role
        ORDER BY points DESC
        LIMIT 3;
      `;
      const [rows] = await pool.query(query);
      return rows || [];
    } catch (error) {
      console.error('Model error:', error);
      throw error;
    }
  }
}

module.exports = AchievementModel;
