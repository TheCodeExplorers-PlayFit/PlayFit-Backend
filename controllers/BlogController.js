// controllers/BlogController.js
const { pool } = require('../config/db');

const getApprovedBlogs = async (req, res) => {
  const query = `
    SELECT 
      blogs.id,
      blogs.title,
      blogs.content,
      blogs.image,
      blogs.created_at,
      users.first_name,
      users.last_name,
      users.role
    FROM blogs
    JOIN users ON blogs.user_id = users.id
    WHERE blogs.status = 'approved'
    ORDER BY blogs.created_at DESC
  `;

  try {
    const [results] = await pool.execute(query);
    res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching approved blogs:', error);
    res.status(500).json({ error: 'Database error' });
  }
};

module.exports = {
  getApprovedBlogs
};
