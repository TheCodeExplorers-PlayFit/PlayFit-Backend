const pool = require('../config/db');

async function addPlayerPackage(req, res) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { name, description, price, duration, sport, stadiumId, start_date, end_date } = req.body;

    console.log('Received player package data:', { name, description, price, duration, sport, stadiumId, start_date, end_date });

    if (!name || !price || !duration || !sport || !stadiumId || !start_date || !end_date) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const ownerId = req.user.id;

    const [stadiumRows] = await connection.execute(
      'SELECT id FROM stadiums WHERE id = ? AND owner_id = ?',
      [stadiumId, ownerId]
    );
    if (stadiumRows.length === 0) {
      return res.status(403).json({ message: 'Unauthorized access to stadium' });
    }

    const sqlPackage = `
      INSERT INTO player_packages (name, description, price, duration, sport, stadium_id, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [packageResult] = await connection.execute(sqlPackage, [
      name,
      description || null,
      price,
      duration,
      sport,
      stadiumId,
      start_date,
      end_date
    ]);
    const packageId = packageResult.insertId;

    await connection.commit();
    res.status(201).json({ message: 'Player package added successfully', packageId });
  } catch (error) {
    await connection.rollback();
    console.error('Error adding player package:', error);
    res.status(500).json({ message: 'Error adding player package', error: error.message });
  } finally {
    connection.release();
  }
}

async function assignPlayerToPackage(req, res) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { packageId, start_date, end_date } = req.body;
    const playerId = req.user.id;

    if (!packageId || !start_date || !end_date) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const [packageRows] = await connection.execute(
      'SELECT duration, start_date, end_date FROM player_packages WHERE id = ?',
      [packageId]
    );
    if (packageRows.length === 0) {
      return res.status(404).json({ message: 'Package not found' });
    }

    const pkg = packageRows[0];
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const pkgStartDate = new Date(pkg.start_date);
    const pkgEndDate = new Date(pkg.end_date);

    if (startDate < pkgStartDate || endDate > pkgEndDate) {
      return res.status(400).json({ message: 'Assignment dates must fall within the package’s valid period' });
    }

    const sqlAssignment = `
      INSERT INTO player_package_assignments (player_id, package_id, start_date, end_date)
      VALUES (?, ?, ?, ?)
    `;
    await connection.execute(sqlAssignment, [playerId, packageId, start_date, end_date]);

    await connection.commit();
    res.status(201).json({ message: 'Package assigned to player successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error assigning package to player:', error);
    res.status(500).json({ message: 'Error assigning package to player', error: error.message });
  } finally {
    connection.release();
  }
}

async function getPlayerPackages(req, res) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(`
      SELECT pp.id, pp.name, pp.description, pp.price, pp.duration, pp.sport, pp.stadium_id, s.name AS stadium_name, pp.start_date, pp.end_date
      FROM player_packages pp
      JOIN stadiums s ON pp.stadium_id = s.id
      WHERE s.owner_id = ?
      ORDER BY pp.created_at DESC
    `, [req.user.id]);

    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching player packages:', error);
    res.status(500).json({ message: 'Error fetching player packages', error: error.message });
  } finally {
    connection.release();
  }
}

async function getPlayerPackageAssignments(req, res) {
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
    `, [req.user.id]);

    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching player package assignments:', error);
    res.status(500).json({ message: 'Error fetching player package assignments', error: error.message });
  } finally {
    connection.release();
  }
}

async function updatePlayerPackage(req, res) {
  const connection = await pool.getConnection();
  try {
    const { id, name, description, price, duration, sport, stadiumId, start_date, end_date } = req.body;

    console.log('Updating player package with data:', { id, name, description, price, duration, sport, stadiumId, start_date, end_date });

    if (!id || !name || !price || !duration || !sport || !stadiumId || !start_date || !end_date) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    await connection.beginTransaction();

    const ownerId = req.user.id;

    const [stadiumRows] = await connection.execute(
      'SELECT id FROM stadiums WHERE id = ? AND owner_id = ?',
      [stadiumId, ownerId]
    );
    if (stadiumRows.length === 0) {
      return res.status(403).json({ message: 'Unauthorized access to stadium' });
    }

    const sqlUpdate = `
      UPDATE player_packages
      SET name = ?, description = ?, price = ?, duration = ?, sport = ?, stadium_id = ?, start_date = ?, end_date = ?
      WHERE id = ?
    `;
    const [updateResult] = await connection.execute(sqlUpdate, [
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

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Player package not found' });
    }

    await connection.commit();
    res.status(200).json({ message: 'Player package updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating player package:', error);
    res.status(500).json({ message: 'Error updating player package', error: error.message });
  } finally {
    connection.release();
  }
}

async function deletePlayerPackage(req, res) {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    console.log('Deleting player package with id:', id);

    await connection.beginTransaction();

    const [packageRows] = await connection.execute(
      'SELECT pp.id FROM player_packages pp JOIN stadiums s ON pp.stadium_id = s.id WHERE pp.id = ? AND s.owner_id = ?',
      [id, req.user.id]
    );
    if (packageRows.length === 0) {
      return res.status(403).json({ message: 'Unauthorized access to package' });
    }

    await connection.execute('DELETE FROM player_packages WHERE id = ?', [id]);
    await connection.commit();
    res.status(200).json({ message: 'Player package deleted successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error deleting player package:', error);
    res.status(500).json({ message: 'Error deleting player package', error: error.message });
  } finally {
    connection.release();
  }
}

async function getSubscriptionStats(req, res) {
  const connection = await pool.getConnection();
  try {
    const ownerId = req.user.id;

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

    res.status(200).json({
      totalPlayers,
      activeSubscriptions,
      expiredSubscriptions,
      mostPopularPackage
    });
  } catch (error) {
    console.error('Error fetching subscription stats:', error);
    res.status(500).json({ message: 'Error fetching subscription stats', error: error.message });
  } finally {
    connection.release();
  }
}

module.exports = {
  addPlayerPackage,
  assignPlayerToPackage,
  getPlayerPackages,
  getPlayerPackageAssignments,
  updatePlayerPackage,
  deletePlayerPackage,
  getSubscriptionStats
};