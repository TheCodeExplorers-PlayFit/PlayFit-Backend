const { pool } = require('../config/db');

class PlayerPackageModel {
  static async addPlayerPackage({ name, description, price, duration, sport, stadiumId, start_date, end_date, ownerId }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [stadiumRows] = await connection.execute(
        'SELECT id FROM stadiums WHERE id = ? AND owner_id = ?',
        [stadiumId, ownerId]
      );
      if (stadiumRows.length === 0) {
        throw new Error('Unauthorized access to stadium');
      }
      const sql = `
        INSERT INTO player_packages (name, description, price, duration, sport, stadium_id, start_date, end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [result] = await connection.execute(sql, [
        name,
        description || null,
        price,
        duration,
        sport,
        stadiumId,
        start_date,
        end_date
      ]);
      await connection.commit();
      return { packageId: result.insertId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async assignPlayerToPackage({ packageId, playerId, start_date, end_date }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      // Check for existing assignment with same player_id and package_id
      const [existingRows] = await connection.execute(
        'SELECT id FROM player_package_assignments WHERE player_id = ? AND package_id = ?',
        [playerId, packageId]
      );
      if (existingRows.length > 0) {
        throw new Error('Player is already assigned to this package');
      }
      // Validate package and dates
      const [packageRows] = await connection.execute(
        'SELECT start_date, end_date FROM player_packages WHERE id = ?',
        [packageId]
      );
      if (packageRows.length === 0) {
        throw new Error('Package not found');
      }
      const pkg = packageRows[0];
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      const pkgStartDate = new Date(pkg.start_date);
      const pkgEndDate = new Date(pkg.end_date);
      if (startDate < pkgStartDate || endDate > pkgEndDate) {
        throw new Error('Assignment dates must fall within the package’s valid period');
      }
      const sql = `
        INSERT INTO player_package_assignments (player_id, package_id, start_date, end_date)
        VALUES (?, ?, ?, ?)
      `;
      await connection.execute(sql, [playerId, packageId, start_date, end_date]);
      await connection.commit();
      return { message: 'Package assigned to player successfully' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getPlayerPackages(ownerId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT pp.id, pp.name, pp.description, pp.price, pp.duration, pp.sport, pp.stadium_id, s.name AS stadium_name, pp.start_date, pp.end_date
        FROM player_packages pp
        JOIN stadiums s ON pp.stadium_id = s.id
        WHERE s.owner_id = ?
        ORDER BY pp.created_at DESC
      `, [ownerId]);
      return rows;
    } finally {
      connection.release();
    }
  }

  static async getPlayerPackageAssignments(ownerId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT 
          ppa.id, 
          ppa.player_id, 
          CONCAT(u.first_name, ' ', u.last_name) AS player_name, 
          pp.name AS package_name, 
          pp.price, 
          pp.sport, 
          pp.stadium_id, 
          s.name AS stadium_name, 
          ppa.start_date, 
          ppa.end_date
        FROM player_package_assignments ppa
        JOIN users u ON ppa.player_id = u.id
        JOIN player_packages pp ON ppa.package_id = pp.id
        JOIN stadiums s ON pp.stadium_id = s.id
        WHERE s.owner_id = ?
        ORDER BY ppa.created_at DESC
      `, [ownerId]);
      return rows;
    } finally {
      connection.release();
    }
  }

  static async updatePlayerPackage({ id, name, description, price, duration, sport, stadiumId, start_date, end_date, ownerId }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [stadiumRows] = await connection.execute(
        'SELECT id FROM stadiums WHERE id = ? AND owner_id = ?',
        [stadiumId, ownerId]
      );
      if (stadiumRows.length === 0) {
        throw new Error('Unauthorized access to stadium');
      }
      const sql = `
        UPDATE player_packages
        SET name = ?, description = ?, price = ?, duration = ?, sport = ?, stadium_id = ?, start_date = ?, end_date = ?
        WHERE id = ?
      `;
      const [result] = await connection.execute(sql, [
        name,
        description || null,
        price,
        duration,
        sport,
        stadiumId,
        start_date,
        end_date,
        id
      ]);
      if (result.affectedRows === 0) {
        throw new Error('Player package not found');
      }
      await connection.commit();
      return { message: 'Player package updated successfully' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async deletePlayerPackage(id, ownerId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [packageRows] = await connection.execute(
        'SELECT pp.id FROM player_packages pp JOIN stadiums s ON pp.stadium_id = s.id WHERE pp.id = ? AND s.owner_id = ?',
        [id, ownerId]
      );
      if (packageRows.length === 0) {
        throw new Error('Unauthorized access to package');
      }
      await connection.execute('DELETE FROM player_packages WHERE id = ?', [id]);
      await connection.commit();
      return { message: 'Player package deleted successfully' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getSubscriptionStats(ownerId) {
    const connection = await pool.getConnection();
    try {
      const [totalRows] = await connection.execute(`
        SELECT COUNT(DISTINCT ppa.player_id) as total 
        FROM player_package_assignments ppa
        JOIN player_packages pp ON ppa.package_id = pp.id
        WHERE pp.stadium_id IN (SELECT id FROM stadiums WHERE owner_id = ?)
      `, [ownerId]);
      const totalPlayers = totalRows.length > 0 ? totalRows[0].total : 0;

      const [activeRows] = await connection.execute(`
        SELECT COUNT(*) as active 
        FROM player_package_assignments ppa
        JOIN player_packages pp ON ppa.package_id = pp.id
        WHERE pp.stadium_id IN (SELECT id FROM stadiums WHERE owner_id = ?) 
        AND ppa.end_date >= CURDATE()
      `, [ownerId]);
      const activeSubscriptions = activeRows.length > 0 ? activeRows[0].active : 0;

      const [expiredRows] = await connection.execute(`
        SELECT COUNT(*) as expired 
        FROM player_package_assignments ppa
        JOIN player_packages pp ON ppa.package_id = pp.id
        WHERE pp.stadium_id IN (SELECT id FROM stadiums WHERE owner_id = ?) 
        AND ppa.end_date < CURDATE()
      `, [ownerId]);
      const expiredSubscriptions = expiredRows.length > 0 ? expiredRows[0].expired : 0;

      const [popularRows] = await connection.execute(`
        SELECT pp.name, COUNT(*) as count 
        FROM player_package_assignments ppa
        JOIN player_packages pp ON ppa.package_id = pp.id
        WHERE pp.stadium_id IN (SELECT id FROM stadiums WHERE owner_id = ?) 
        GROUP BY pp.id, pp.name 
        ORDER BY count DESC 
        LIMIT 1
      `, [ownerId]);
      const mostPopularPackage = popularRows.length > 0 ? popularRows[0].name : null;

      return { totalPlayers, activeSubscriptions, expiredSubscriptions, mostPopularPackage };
    } finally {
      connection.release();
    }
  }
}

module.exports = PlayerPackageModel;