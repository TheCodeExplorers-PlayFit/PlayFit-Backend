const mysql = require('mysql2/promise');
const { pool } = require('../config/db');

class MaintenanceRequestsModel {
static async getMaintenanceRequestsByOwner(ownerId) {
    const query = `
      SELECT 
        r.id AS request_id,
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
    if (!id || !status) {
      throw new Error('Missing required fields');
    }
    if (!['pending', 'resolved', 'in_progress'].includes(status)) {
      throw new Error('Invalid status value');
    }
    try {
      const [result] = await pool.query(
        'UPDATE reports SET status = ? WHERE id = ? AND reported_to = ?',
        [status, id, 'stadiumOwner']
      );
      if (result.affectedRows === 0) {
        throw new Error('Maintenance request not found or unauthorized');
      }
      return { message: 'Status updated successfully' };
    } catch (error) {
      console.error('Error updating maintenance request status:', error);
      throw new Error('Failed to update maintenance request status');
    }
  }
}

module.exports = MaintenanceRequestsModel;