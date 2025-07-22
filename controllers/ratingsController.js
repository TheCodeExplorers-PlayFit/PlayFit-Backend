const { sequelize } = require('../config/db');
const { QueryTypes } = require('sequelize');

exports.searchStadiums = async (req, res) => {
  try {
    const { query } = req.query;
    console.log('Searching stadiums with query:', query); // Debug
    const stadiums = await sequelize.query(
      'SELECT id, name FROM stadiums WHERE LOWER(name) LIKE LOWER(?)',
      { replacements: [`%${query}%`], type: QueryTypes.SELECT }
    );
    console.log('Stadiums found:', stadiums); // Debug
    res.status(200).json({ success: true, data: stadiums });
  } catch (error) {
    console.error('Error searching stadiums:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.searchCoaches = async (req, res) => {
  try {
    const { query } = req.query;
    console.log('Searching coaches with query:', query); // Debug
    const coaches = await sequelize.query(
      `SELECT u.id, u.first_name, u.last_name 
       FROM users u 
       JOIN coach_details cd ON u.id = cd.userId 
       WHERE u.role = 'coach' AND (LOWER(u.first_name) LIKE LOWER(?) OR LOWER(u.last_name) LIKE LOWER(?))`,
      { replacements: [`%${query}%`, `%${query}%`], type: QueryTypes.SELECT }
    );
    console.log('Coaches found:', coaches); // Debug
    res.status(200).json({ success: true, data: coaches });
  } catch (error) {
    console.error('Error searching coaches:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.getRatings = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { limit } = req.query;
    if (!['coach', 'stadium'].includes(entityType)) {
      return res.status(400).json({ success: false, message: 'Invalid entity type' });
    }
    let query = `
      SELECT r.id, r.rating, r.comment, r.created_at, u.first_name, u.last_name
    `;
    const replacements = [entityType];
    
    if (entityType === 'stadium') {
      query += `, s.name AS entity_name`;
    } else {
      query += `, CONCAT(u2.first_name, ' ', u2.last_name) AS entity_name`;
    }
    
    query += `
      FROM ratings r 
      JOIN users u ON r.user_id = u.id
    `;
    
    if (entityType === 'stadium') {
      query += ` LEFT JOIN stadiums s ON r.entity_id = s.id`;
    } else {
      query += ` LEFT JOIN users u2 ON r.entity_id = u2.id`;
    }
    
    query += ` WHERE r.entity_type = ?`;
    
    if (entityId !== '0') {
      query += ' AND r.entity_id = ?';
      replacements.push(entityId);
    }
    
    query += ' ORDER BY r.created_at DESC';
    if (limit) {
      query += ' LIMIT ?';
      replacements.push(parseInt(limit));
    }
    
    const ratings = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT
    });
    res.status(200).json({ success: true, data: ratings });
  } catch (error) {
    console.error('Error fetching ratings:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.createRating = async (req, res) => {
  try {
    const { entityType, entityId, rating, comment } = req.body;
    if (!['coach', 'stadium'].includes(entityType)) {
      return res.status(400).json({ success: false, message: 'Invalid entity type' });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }
    await sequelize.query(
      `INSERT INTO ratings (user_id, entity_type, entity_id, rating, comment) 
       VALUES (?, ?, ?, ?, ?)`,
      {
        replacements: [req.user.id, entityType, entityId, rating, comment || null],
        type: QueryTypes.INSERT
      }
    );
    res.status(201).json({ success: true, message: 'Rating submitted successfully' });
  } catch (error) {
    console.error('Error creating rating:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};