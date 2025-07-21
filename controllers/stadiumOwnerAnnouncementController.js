
const { pool } = require('../config/db');

class StadiumOwnerAnnouncementController {
  static async getAnnouncements(req, res) {
    try {
      const userId = req.user.id;
      const query = `
        SELECT id, admin_id, created_at, category, title, description, notice_date, author
        FROM announcements
        WHERE category = 'stadiumOwner' AND admin_id = ?
      `;
      const [rows] = await pool.execute(query, [userId]);
      res.status(200).json(rows);
    } catch (error) {
      console.error('Error fetching stadium owner announcements:', error);
      res.status(500).json({ message: 'Error fetching announcements', error: error.message });
    }
  }
}

module.exports = StadiumOwnerAnnouncementController;
