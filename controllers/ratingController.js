// controllers/ratingController.js
const { pool } = require('../config/db'); // Changed from database to db

const ratingController = {
  // Get all ratings with detailed information
  getAllRatings: async (req, res) => {
    try {
      const { search, entityType, page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;
      
      let whereClause = '';
      let searchParams = [];
      
      if (search) {
        whereClause += `
          AND (
            (r.entity_type = 'stadium' AND s.name LIKE ?) OR
            (r.entity_type = 'coach' AND CONCAT(coach.first_name, ' ', coach.last_name) LIKE ?)
          )
        `;
        searchParams.push(`%${search}%`, `%${search}%`);
      }
      
      if (entityType && (entityType === 'stadium' || entityType === 'coach')) {
        whereClause += ` AND r.entity_type = ?`;
        searchParams.push(entityType);
      }

      const query = `
        SELECT 
          r.id,
          r.user_id,
          r.entity_type,
          r.entity_id,
          r.rating,
          r.comment,
          r.created_at,
          CONCAT(u.first_name, ' ', u.last_name) as user_name,
          u.email as user_email,
          CASE 
            WHEN r.entity_type = 'stadium' THEN s.name
            WHEN r.entity_type = 'coach' THEN CONCAT(coach.first_name, ' ', coach.last_name)
          END as entity_name,
          CASE 
            WHEN r.entity_type = 'stadium' THEN s.address
            WHEN r.entity_type = 'coach' THEN sports.name
          END as entity_details
        FROM ratings r
        INNER JOIN users u ON r.user_id = u.id
        LEFT JOIN stadiums s ON r.entity_type = 'stadium' AND r.entity_id = s.id
        LEFT JOIN users coach ON r.entity_type = 'coach' AND r.entity_id = coach.id
        LEFT JOIN coach_details cd ON r.entity_type = 'coach' AND coach.id = cd.userId
        LEFT JOIN sports ON cd.sport1 = sports.id
        WHERE 1=1 ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ratings r
        INNER JOIN users u ON r.user_id = u.id
        LEFT JOIN stadiums s ON r.entity_type = 'stadium' AND r.entity_id = s.id
        LEFT JOIN users coach ON r.entity_type = 'coach' AND r.entity_id = coach.id
        WHERE 1=1 ${whereClause}
      `;

      const [ratings] = await pool.execute(query, [...searchParams, parseInt(limit), parseInt(offset)]);
      const [countResult] = await pool.execute(countQuery, searchParams);
      
      res.json({
        success: true,
        data: ratings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching ratings:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching ratings',
        error: error.message
      });
    }
  },

  // Get rating statistics
  getRatingStatistics: async (req, res) => {
    try {
      // Overall statistics
      const [overallStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_ratings,
          AVG(rating) as average_rating,
          MIN(rating) as min_rating,
          MAX(rating) as max_rating
        FROM ratings
      `);

      // Rating distribution
      const [ratingDistribution] = await pool.execute(`
        SELECT 
          rating,
          COUNT(*) as count,
          ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM ratings)), 2) as percentage
        FROM ratings 
        GROUP BY rating 
        ORDER BY rating DESC
      `);

      // Statistics by entity type
      const [entityStats] = await pool.execute(`
        SELECT 
          entity_type,
          COUNT(*) as total_ratings,
          AVG(rating) as average_rating
        FROM ratings 
        GROUP BY entity_type
      `);

      // Top rated stadiums
      const [topStadiums] = await pool.execute(`
        SELECT 
          s.id,
          s.name,
          COUNT(r.id) as rating_count,
          AVG(r.rating) as average_rating
        FROM stadiums s
        INNER JOIN ratings r ON s.id = r.entity_id AND r.entity_type = 'stadium'
        GROUP BY s.id, s.name
        ORDER BY average_rating DESC, rating_count DESC
        LIMIT 5
      `);

      // Top rated coaches
      const [topCoaches] = await pool.execute(`
        SELECT 
          u.id,
          CONCAT(u.first_name, ' ', u.last_name) as name,
          COUNT(r.id) as rating_count,
          ROUND(AVG(r.rating), 2) as average_rating
        FROM users u
        INNER JOIN ratings r ON u.id = r.entity_id AND r.entity_type = 'coach'
        WHERE u.role = 'coach'
        GROUP BY u.id, u.first_name, u.last_name
        HAVING COUNT(r.id) > 0
        ORDER BY average_rating DESC, rating_count DESC
        LIMIT 5
      `);

      res.json({
        success: true,
        data: {
          overall: overallStats[0],
          distribution: ratingDistribution,
          byEntityType: entityStats,
          topStadiums,
          topCoaches
        }
      });
    } catch (error) {
      console.error('Error fetching rating statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching statistics',
        error: error.message
      });
    }
  },

  // Get ratings for specific entity
  getEntityRatings: async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      
      if (!['stadium', 'coach'].includes(entityType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid entity type'
        });
      }

      const query = `
        SELECT 
          r.id,
          r.rating,
          r.comment,
          r.created_at,
          CONCAT(u.first_name, ' ', u.last_name) as user_name,
          u.email as user_email
        FROM ratings r
        INNER JOIN users u ON r.user_id = u.id
        WHERE r.entity_type = ? AND r.entity_id = ?
        ORDER BY r.created_at DESC
      `;

      const statsQuery = `
        SELECT 
          COUNT(*) as total_ratings,
          AVG(rating) as average_rating,
          MIN(rating) as min_rating,
          MAX(rating) as max_rating
        FROM ratings 
        WHERE entity_type = ? AND entity_id = ?
      `;

      const [ratings] = await pool.execute(query, [entityType, entityId]);
      const [stats] = await pool.execute(statsQuery, [entityType, entityId]);

      res.json({
        success: true,
        data: {
          ratings,
          statistics: stats[0]
        }
      });
    } catch (error) {
      console.error('Error fetching entity ratings:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching entity ratings',
        error: error.message
      });
    }
  },

  // Delete a rating
  deleteRating: async (req, res) => {
    try {
      const { id } = req.params;
      
      const [result] = await pool.execute(
        'DELETE FROM ratings WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Rating not found'
        });
      }

      res.json({
        success: true,
        message: 'Rating deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting rating:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting rating',
        error: error.message
      });
    }
  }
};

module.exports = ratingController;