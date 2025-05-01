// routes/announcementRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Create a new notice
router.post('/create', async (req, res) => {
  const { admin_id, category, title, description, notice_date, author } = req.body;

  try {
    const [result] = await db.query(
      'INSERT INTO announcements (admin_id, category, title, description, notice_date, author, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [admin_id, category, title, description, notice_date, author]
    );
    res.status(201).json({ message: 'Notice created successfully', id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all notices
router.get('/', async (req, res) => {
  try {
    const [notices] = await db.query('SELECT * FROM announcements ORDER BY created_at DESC');
    res.status(200).json(notices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a notice
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { category, title, description, notice_date, author } = req.body;

  try {
    const [result] = await db.query(
      'UPDATE announcements SET category = ?, title = ?, description = ?, notice_date = ?, author = ? WHERE id = ?',
      [category, title, description, notice_date, author, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notice not found' });
    }
    res.status(200).json({ message: 'Notice updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a notice
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM announcements WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notice not found' });
    }
    res.status(200).json({ message: 'Notice deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;