const pool = require('../config/db');

async function addPlayerPackage(req, res) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { name, description, price, duration, sport, stadiumId } = req.body;

    console.log('Received player package data:', { name, description, price, duration, sport, stadiumId });

    if (!name || !price || !duration || !sport || !stadiumId) {
      return res.status(400).json({ message: 'Missing required fields: name, price, duration, sport, or stadiumId' });
    }

    const ownerId = req.user.id;

    // Verify the stadium belongs to the user
    const [stadiumRows] = await connection.execute(
      'SELECT id FROM stadiums WHERE id = ? AND owner_id = ?',
      [stadiumId, ownerId]
    );
    if (stadiumRows.length === 0) {
      return res.status(403).json({ message: 'Stadium not found or you do not have permission to add packages to it' });
    }

    const sqlPackage = `
      INSERT INTO player_packages (name, description, price, duration, sport, stadium_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [packageResult] = await connection.execute(sqlPackage, [
      name,
      description || null,
      price,
      duration,
      sport,
      stadiumId
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

async function getPlayerPackages(req, res) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(`
      SELECT pp.id, pp.name, pp.description, pp.price, pp.duration, pp.sport, pp.stadium_id, s.name AS stadium_name
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

async function updatePlayerPackage(req, res) {
  const connection = await pool.getConnection();
  try {
    const { id, name, description, price, duration, sport, stadiumId } = req.body;

    console.log('Updating player package with data:', { id, name, description, price, duration, sport, stadiumId });

    if (!id || !name || !price || !duration || !sport || !stadiumId) {
      return res.status(400).json({ message: 'Missing required fields: id, name, price, duration, sport, or stadiumId' });
    }

    await connection.beginTransaction();

    const ownerId = req.user.id;

    // Verify the stadium belongs to the user
    const [stadiumRows] = await connection.execute(
      'SELECT id FROM stadiums WHERE id = ? AND owner_id = ?',
      [stadiumId, ownerId]
    );
    if (stadiumRows.length === 0) {
      return res.status(403).json({ message: 'Stadium not found or you do not have permission to update packages for it' });
    }

    const sqlUpdate = `
      UPDATE player_packages
      SET name = ?, description = ?, price = ?, duration = ?, sport = ?, stadium_id = ?
      WHERE id = ?
    `;
    const [updateResult] = await connection.execute(sqlUpdate, [
      name,
      description || null,
      price,
      duration,
      sport,
      stadiumId,
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
      return res.status(403).json({ message: 'Player package not found or you do not have permission to delete it' });
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

module.exports = {
  addPlayerPackage,
  getPlayerPackages,
  updatePlayerPackage,
  deletePlayerPackage
};