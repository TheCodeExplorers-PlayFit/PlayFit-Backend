const mysql = require('mysql2/promise');
const { pool } = require('../config/db');

class MaintenanceRequestsModel {
static async getMaintenanceRequestsByOwner(ownerId) {
    const query = `
      SELECT 
        r.id AS id,
        r.reported_by,
        CONCAT(u.first_name, ' ', u.last_name) AS reported_by_name,
        r.reported_to,
        r.stadium_id,
        s.name AS stadium_name,
        s.owner_id,
        CONCAT(o.first_name, ' ', o.last_name) AS owner_name,
        o.email AS owner_email,
        r.coach_id,
        r.description,
        r.status,
        r.created_at
      FROM reports r
      LEFT JOIN users u ON r.reported_by = u.id
      LEFT JOIN stadiums s ON r.stadium_id = s.id
      LEFT JOIN users o ON s.owner_id = o.id
      WHERE r.reported_to = 'stadiumOwner' AND s.owner_id = ?
    `;
    const [rows] = await pool.query(query, [ownerId]);
    return rows;
  }


  static async updateMaintenanceRequest(id, status) {
    const [result] = await pool.query(
      'UPDATE reports SET status = ? WHERE id = ?',
      [status, id]
    );
    if (result.affectedRows === 0) {
      throw new Error(`Maintenance request with ID ${id} not found`);
    }
    return { id, status };
  }
}


module.exports = MaintenanceRequestsModel;