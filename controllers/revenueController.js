const { pool } = require('../config/db');

class RevenueController {
  static async getRevenueData(req, res) {
    try {
      const userId = req.user.id; // Assumes authentication middleware sets req.user
      const currentDate = new Date();
      currentDate.setMonth(currentDate.getMonth() - 1); // Previous month
      const previousMonth = currentDate.toISOString().slice(0, 7); // e.g., '2025-06'
      const query = `
       
            SELECT 
                s.id AS stadium_id,
                s.name AS stadium_name,
                COALESCE(SUM(ses.stadium_sport_cost * (
                SELECT COUNT(DISTINCT pb2.player_id) 
                FROM player_bookings pb2 
                WHERE pb2.session_id = ses.id
                )), 0) AS total_revenue
            FROM 
                stadiums s
                LEFT JOIN sessions ses ON ses.stadium_id = s.id 
                AND ses.status = 'booked'
                AND EXISTS (
                    SELECT 1 FROM player_bookings pb 
                    WHERE pb.session_id = ses.id 
                    AND DATE_FORMAT(pb.booking_date, '%Y-%m') = ?
                )
            WHERE 
                s.owner_id = ?
            GROUP BY 
                s.id, s.name
            ORDER BY 
                s.name ASC;


      `;
      const [rows] = await pool.execute(query, [previousMonth, userId]);
      res.status(200).json(rows);
    } catch (error) {
      console.error('Error fetching revenue data:', error);
      res.status(500).json({ message: 'Error fetching revenue data', error: error.message });
    }
  }
}

module.exports = RevenueController;