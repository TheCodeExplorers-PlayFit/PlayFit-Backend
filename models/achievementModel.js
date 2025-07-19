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
          (SELECT GROUP_CONCAT(DISTINCT first_name SEPARATOR ', ') FROM users u 
           JOIN (
             SELECT user_id, SUM(COALESCE(player_points, 0) + COALESCE(coach_points, 0)) as maxPoints 
             FROM (
               SELECT pb.player_id as user_id, COUNT(pb.id) * 10 as player_points, 0 as coach_points 
               FROM player_bookings pb
               GROUP BY pb.player_id
               UNION ALL
               SELECT s.coach_id as user_id, 0 as player_points, COUNT(s.id) * 10 as coach_points 
               FROM sessions s
               WHERE s.coach_id IS NOT NULL
               GROUP BY s.coach_id
             ) bookings 
             GROUP BY user_id
           ) b ON u.id = b.user_id 
           WHERE b.maxPoints = (
             SELECT MAX(totalPoints) FROM (
               SELECT user_id, SUM(COALESCE(player_points, 0) + COALESCE(coach_points, 0)) as totalPoints 
               FROM (
                 SELECT pb.player_id as user_id, COUNT(pb.id) * 10 as player_points, 0 as coach_points 
                 FROM player_bookings pb
                 GROUP BY pb.player_id
                 UNION ALL
                 SELECT s.coach_id as user_id, 0 as player_points, COUNT(s.id) * 10 as coach_points 
                 FROM sessions s
                 WHERE s.coach_id IS NOT NULL
                 GROUP BY s.coach_id
               ) allBookings 
               GROUP BY user_id
             ) maxScores
           )) as topAchiever,
          (SELECT sport_name FROM (
             SELECT sp.name as sport_name, COUNT(*) as activity_count
             FROM sessions s 
             JOIN sports sp ON s.sport_id = sp.id
             WHERE s.coach_id IS NOT NULL OR s.id IN (SELECT DISTINCT session_id FROM player_bookings)
             GROUP BY sp.id, sp.name
             ORDER BY activity_count DESC
             LIMIT 1
           ) most_active) as mostActiveModule,
          (SELECT DATE_FORMAT(MAX(latest_date), '%Y-%m-%d') FROM (
             SELECT MAX(pb.booking_date) as latest_date FROM player_bookings pb
             UNION ALL
             SELECT MAX(s.start_time) as latest_date FROM sessions s WHERE s.coach_id IS NOT NULL
           ) dates) as mostRecent
      `;
      
      if (userRole === 'stadiumOwner' && userId) {
        query += ` WHERE EXISTS (
          SELECT 1 FROM stadiums st WHERE st.owner_id = ?
        )`;
      }
      
      const [rows] = await pool.query(query, userRole === 'stadiumOwner' && userId ? [userId] : []);
      return rows[0] || { 
        totalUnlocked: 0, 
        topAchiever: 'N/A', 
        mostActiveModule: 'N/A', 
        mostRecent: 'N/A' 
      };
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
             WHERE s.id = (
               SELECT stadium_id FROM sessions se 
               WHERE se.coach_id = u.id AND se.id = (
                 SELECT MAX(id) FROM sessions WHERE coach_id = u.id
               )
               UNION
               SELECT se.stadium_id FROM sessions se 
               JOIN player_bookings pb ON se.id = pb.session_id 
               WHERE pb.player_id = u.id AND pb.booking_date = (
                 SELECT MAX(booking_date) FROM player_bookings WHERE player_id = u.id
               )
               LIMIT 1
             )),
            'N/A'
          ) AS stadiumName,
          COALESCE(
            GREATEST(
              COALESCE((SELECT MAX(booking_date) FROM player_bookings WHERE player_id = u.id), '1900-01-01'),
              COALESCE((SELECT MAX(DATE(start_time)) FROM sessions WHERE coach_id = u.id), '1900-01-01')
            ),
            CURDATE()
          ) AS dateEarned,
          u.role AS userType,
          (COALESCE(
            (SELECT COUNT(*) FROM player_bookings pb2 WHERE pb2.player_id = u.id),
            0
          ) + COALESCE(
            (SELECT COUNT(*) FROM sessions se2 WHERE se2.coach_id = u.id),
            0
          )) AS sessionsCount,
          (COALESCE(
            (SELECT COUNT(*) * 10 FROM player_bookings pb2 WHERE pb2.player_id = u.id),
            0
          ) + COALESCE(
            (SELECT COUNT(*) * 10 FROM sessions se2 WHERE se2.coach_id = u.id),
            0
          )) AS points
        FROM users u
        CROSS JOIN (SELECT @row_number := 0) AS init
        WHERE u.role IN ('player', 'coach') 
        AND u.first_name IS NOT NULL
        AND (
          EXISTS (SELECT 1 FROM player_bookings pb2 WHERE pb2.player_id = u.id) OR
          EXISTS (SELECT 1 FROM sessions se2 WHERE se2.coach_id = u.id)
        )
      `;
      
      if (userRole === 'stadiumOwner' && userId) {
        query += ` AND EXISTS (
          SELECT 1 FROM stadiums st WHERE st.owner_id = ? AND (
            st.id IN (SELECT stadium_id FROM sessions WHERE coach_id = u.id) OR
            st.id IN (SELECT se.stadium_id FROM sessions se 
                     JOIN player_bookings pb ON se.id = pb.session_id 
                     WHERE pb.player_id = u.id)
          )
        )`;
      }
      
      query += ` GROUP BY u.id, u.first_name, u.role
                 ORDER BY points DESC, sessionsCount DESC`;
      
      console.log('Executing query:', query);
      const [rows] = await pool.query(query, userRole === 'stadiumOwner' && userId ? [userId] : []);
      console.log('Query result:', rows);
      
      return rows.map((row) => ({ 
        ...row, 
        id: row.unique_id,
        dateEarned: row.dateEarned instanceof Date ? 
          row.dateEarned.toISOString().split('T')[0] : 
          row.dateEarned
      }));
    } catch (error) {
      console.error('Model error:', error);
      throw error;
    }
  }

  static async getTopAchieversByStadium(req) {
    try {
      const query = `
        SELECT 
          s.id AS stadium_id,
          s.name AS stadiumName,
          GROUP_CONCAT(DISTINCT u.first_name ORDER BY usp.points DESC SEPARATOR ', ') AS topAchiever,
          GROUP_CONCAT(DISTINCT u.role ORDER BY usp.points DESC SEPARATOR ', ') AS userType,
          MAX(usp.points) AS points
        FROM stadiums s
        JOIN (
          SELECT 
            stadium_id,
            user_id,
            user_name,
            user_role,
            total_points as points
          FROM (
            SELECT 
              se.stadium_id,
              u.id as user_id,
              u.first_name as user_name,
              u.role as user_role,
              (COALESCE(
                (SELECT COUNT(*) * 10 FROM player_bookings pb 
                 JOIN sessions s2 ON pb.session_id = s2.id 
                 WHERE pb.player_id = u.id AND s2.stadium_id = se.stadium_id),
                0
              ) + COALESCE(
                (SELECT COUNT(*) * 10 FROM sessions se2 
                 WHERE se2.coach_id = u.id AND se2.stadium_id = se.stadium_id),
                0
              )) AS total_points
            FROM sessions se
            JOIN users u ON (
              u.id IN (
                SELECT player_id FROM player_bookings pb 
                JOIN sessions s2 ON pb.session_id = s2.id
                WHERE s2.stadium_id = se.stadium_id
              ) OR 
              u.id IN (
                SELECT coach_id FROM sessions WHERE stadium_id = se.stadium_id AND coach_id IS NOT NULL
              )
            )
            WHERE u.role IN ('player', 'coach')
            GROUP BY se.stadium_id, u.id, u.first_name, u.role
            HAVING total_points > 0
          ) user_stadium_points
        ) usp ON s.id = usp.stadium_id
        JOIN users u ON u.id = usp.user_id
        WHERE usp.points = (
          SELECT MAX(total_points) 
          FROM (
            SELECT 
              (COALESCE(
                (SELECT COUNT(*) * 10 FROM player_bookings pb 
                 JOIN sessions s2 ON pb.session_id = s2.id 
                 WHERE pb.player_id = users.id AND s2.stadium_id = s.id),
                0
              ) + COALESCE(
                (SELECT COUNT(*) * 10 FROM sessions se 
                 WHERE se.coach_id = users.id AND se.stadium_id = s.id),
                0
              )) AS total_points
            FROM users
            WHERE users.id IN (
              SELECT player_id FROM player_bookings pb 
              JOIN sessions s2 ON pb.session_id = s2.id
              WHERE s2.stadium_id = s.id
              UNION
              SELECT coach_id FROM sessions WHERE stadium_id = s.id AND coach_id IS NOT NULL
            )
          ) max_points_subquery
        )
        GROUP BY s.id, s.name, usp.points
        ORDER BY usp.points DESC
        LIMIT 10;
      `;
      
      const [rows] = await pool.query(query);
      
      return rows.map(row => ({
        stadium_id: row.stadium_id,
        stadiumName: row.stadiumName,
        topAchiever: row.topAchiever, // This will contain all achievers with same max points
        userType: row.userType,
        points: row.points
      })) || [];
    } catch (error) {
      console.error('Model error:', error);
      throw error;
    }
  }

  static async updateAchievement(id, data) {
    try {
      const { points, dateEarned } = data;
      const query = `
        UPDATE users 
        SET points = ?, dateEarned = ? 
        WHERE id = ?
      `;
      const [result] = await pool.query(query, [points, dateEarned, id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Update error:', error);
      throw error;
    }
  }

  static async deleteAchievement(id) {
    try {
      // Note: This doesn't actually delete users, but rather removes their achievement data
      const query = `
        UPDATE users 
        SET points = 0, dateEarned = NULL 
        WHERE id = ?
      `;
      const [result] = await pool.query(query, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  }
}

module.exports = AchievementModel;