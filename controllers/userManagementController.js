const { pool } = require('../config/db');

// Get all users except admins with counts
exports.getAllUsers = async (req, res) => {
  try {
    // Fetch all users except admins
    const [users] = await db.query(`
      SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email, 
        u.mobile_number AS phone, 
        u.role,
        u.gender,
        u.age,
        u.nic,
        u.created_at
      FROM users u
      WHERE u.role != 'admin'
    `);

    // Calculate role-wise counts
    const roleCounts = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: users,
      totalCount: users.length,
      roleCounts: {
        player: roleCounts.player || 0,
        coach: roleCounts.coach || 0,
        stadiumOwner: roleCounts.stadiumOwner || 0,
        medicalOfficer: roleCounts.medicalOfficer || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Delete a user
exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const [user] = await db.query('SELECT * FROM users WHERE id = ?', [id]);

    if (!user.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    await db.query('DELETE FROM users WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};