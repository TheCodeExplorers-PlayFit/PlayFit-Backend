const {pool} = require('../config/db');

class AchievementModel {
  static async getAchievements() {
    try {
      const [rows] = await pool.query(
        'SELECT COUNT(*) as totalUnlocked, (SELECT first_name FROM users WHERE points = (SELECT MAX(points) FROM users)) as topAchiever, ' +
        '(SELECT role FROM users WHERE points = (SELECT MAX(points) FROM users)) as mostActiveModule, ' +
        '(SELECT status FROM users WHERE points = (SELECT MAX(points) FROM users)) as mostRecent ' +
        'FROM users'
      );
      return rows[0] || { totalUnlocked: 0, topAchiever: 'N/A', mostActiveModule: 'N/A', mostRecent: 'N/A' };
    } catch (error) {
      console.error('Model error:', error);
      throw error;
    }
  }

  static async getAchievementDetails() {
    try {
      const [rows] = await pool.query(
        'SELECT u.first_name AS achievementName, s.name AS stadiumName, u.dateEarned, u.role AS userType, u.points, u.status, u.id ' +
        'FROM users u ' +
        'LEFT JOIN stadiums s ON u.id = s.owner_id ' +
        'WHERE u.points > 0 ' +
        'ORDER BY u.points DESC'
      );
      return rows || [];
    } catch (error) {
      console.error('Model error:', error);
      throw error;
    }
  }

  static async getTop3Achievers() {
    try {
      const [rows] = await pool.query(
        'SELECT u.first_name AS topAchiever, u.points, u.role AS userType ' +
        'FROM users u ' +
        'ORDER BY u.points DESC ' +
        'LIMIT 3'
      );
      return rows;
    } catch (error) {
      console.error('Model error:', error);
      throw error;
    }
  }

  static async updateAchievement(id, updates) {
    try {
      const { points, status, dateEarned } = updates;
      const [result] = await pool.query(
        'UPDATE users SET points = ?, status = ?, dateEarned = ? WHERE id = ?',
        [points, status, dateEarned, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Model error:', error);
      throw error;
    }
  }

  static async deleteAchievement(id) {
    try {
      const [result] = await pool.query(
        'DELETE FROM users WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Model error:', error);
      throw error;
    }
  }
}

module.exports = AchievementModel;