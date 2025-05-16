const pool = require('../config/db');

exports.getPendingBlogs = async (req, res) => {
  try {
    console.log('getPendingBlogs: Fetching blogs with verified = 0');
    const query = `
      SELECT b.id, b.user_id, b.title, b.content, b.created_at, u.first_name, u.last_name, u.role
      FROM blogs b
      JOIN users u ON b.user_id = u.id
      WHERE b.verified = 0
      ORDER BY b.created_at DESC
    `;
    const [blogs] = await pool.query(query);
    console.log('getPendingBlogs: Fetched blogs:', blogs);
    res.json(blogs);
  } catch (err) {
    console.error('getPendingBlogs: Error fetching blogs:', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

exports.approveBlog = async (req, res) => {
  const { id } = req.params;
  try {
    console.log('approveBlog: Approving blog with ID:', id);
    const [blog] = await pool.query('SELECT id FROM blogs WHERE id = ? AND verified = 0', [id]);
    if (!blog[0]) {
      console.log('approveBlog: Blog not found or already verified');
      return res.status(404).json({ error: 'Blog not found or already verified' });
    }

    await pool.query('UPDATE blogs SET verified = 1 WHERE id = ?', [id]);
    console.log('approveBlog: Blog approved successfully');
    res.status(200).json({ message: 'Blog approved successfully' });
  } catch (err) {
    console.error('approveBlog: Error approving blog:', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

exports.rejectBlog = async (req, res) => {
  const { id } = req.params;
  try {
    console.log('rejectBlog: Rejecting blog with ID:', id);
    const [blog] = await pool.query('SELECT id FROM blogs WHERE id = ?', [id]);
    if (!blog[0]) {
      console.log('rejectBlog: Blog not found');
      return res.status(404).json({ error: 'Blog not found' });
    }

    await pool.query('DELETE FROM blogs WHERE id = ?', [id]);
    console.log('rejectBlog: Blog rejected and deleted successfully');
    res.status(200).json({ message: 'Blog rejected and deleted successfully' });
  } catch (err) {
    console.error('rejectBlog: Error rejecting blog:', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};