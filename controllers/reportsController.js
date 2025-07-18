// controllers/reportsController.js

const { sequelize } = require('../config/db');

class ReportsController {

  // Monthly Financial Report
  async getMonthlyFinancialReport(req, res) {
    try {
      const { year, month } = req.query;
      
      if (!year || !month) {
        return res.status(400).json({ success: false, error: 'Year and month are required' });
      }

      // Get current month data
      const currentQuery = `
        SELECT 
          DATE_FORMAT(p.payment_date, '%Y-%m') as month,
          DATE_FORMAT(p.payment_date, '%M %Y') as month_name,
          COALESCE(SUM(p.amount), 0) as total_revenue,
          COUNT(DISTINCT p.id) as total_transactions,
          COUNT(DISTINCT p.player_id) as unique_players,
          ROUND(AVG(p.amount), 2) as avg_transaction_value
        FROM payments p
        WHERE YEAR(p.payment_date) = ? AND MONTH(p.payment_date) = ?
        AND p.status = 'completed'
        GROUP BY DATE_FORMAT(p.payment_date, '%Y-%m'), DATE_FORMAT(p.payment_date, '%M %Y')
      `;
      
      // Get popular session type
      const popularSessionQuery = `
        SELECT sp.name as sport_name, COUNT(*) as booking_count
        FROM sports sp 
        JOIN sessions sess ON sp.id = sess.sport_id 
        JOIN player_bookings pb ON sess.id = pb.session_id 
        JOIN payments pay ON pb.payment_id = pay.id 
        WHERE YEAR(pay.payment_date) = ? AND MONTH(pay.payment_date) = ?
        AND pay.status = 'completed'
        GROUP BY sp.id, sp.name
        ORDER BY booking_count DESC 
        LIMIT 1
      `;
      
      // Calculate previous month for growth rate
      const prevMonth = month > 1 ? month - 1 : 12;
      const prevYear = month > 1 ? year : year - 1;
      
      // Get previous month data for growth calculation
      const prevMonthQuery = `
        SELECT COALESCE(SUM(amount), 0) as prev_revenue
        FROM payments 
        WHERE YEAR(payment_date) = ? AND MONTH(payment_date) = ? AND status = 'completed'
      `;
      
      // Execute queries
      const [currentResults] = await sequelize.query(currentQuery, { replacements: [year, month] });
      const [popularResults] = await sequelize.query(popularSessionQuery, { replacements: [year, month] });
      const [prevResults] = await sequelize.query(prevMonthQuery, { replacements: [prevYear, prevMonth] });
      
      // Calculate growth rate
      const currentRevenue = currentResults[0]?.total_revenue || 0;
      const prevRevenue = prevResults[0]?.prev_revenue || 0;
      const growth_rate = prevRevenue > 0 ? 
        Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100 * 10) / 10 : 0;
      
      const data = currentResults[0] ? {
        ...currentResults[0],
        popular_session_type: popularResults[0]?.sport_name || 'No bookings',
        growth_rate: growth_rate
      } : {
        month: `${year}-${month.toString().padStart(2, '0')}`,
        month_name: new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        total_revenue: 0,
        total_transactions: 0,
        unique_players: 0,
        avg_transaction_value: 0,
        popular_session_type: 'No bookings',
        growth_rate: 0
      };

      console.log('Financial Report Data:', data); // Debug log
      res.json({ success: true, data });
    } catch (error) {
      console.error('Monthly financial report error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Financial Report Range
  async getFinancialReportRange(req, res) {
    try {
      const { startYear, startMonth, endYear, endMonth } = req.query;
      
      if (!startYear || !startMonth || !endYear || !endMonth) {
        return res.status(400).json({ success: false, error: 'All date parameters are required' });
      }

      const query = `
        SELECT 
          DATE_FORMAT(p.payment_date, '%Y-%m') as month,
          DATE_FORMAT(p.payment_date, '%M %Y') as month_name,
          COALESCE(SUM(p.amount), 0) as total_revenue,
          COUNT(DISTINCT p.id) as total_transactions,
          COUNT(DISTINCT p.player_id) as unique_players,
          ROUND(AVG(p.amount), 2) as avg_transaction_value,
          'Multiple Sports' as popular_session_type,
          0 as growth_rate
        FROM payments p
        WHERE p.payment_date >= ? AND p.payment_date <= ?
        AND p.status = 'completed'
        GROUP BY DATE_FORMAT(p.payment_date, '%Y-%m'), DATE_FORMAT(p.payment_date, '%M %Y')
        ORDER BY month
      `;
      
      const startDate = `${startYear}-${startMonth.toString().padStart(2, '0')}-01`;
      const endDate = `${endYear}-${endMonth.toString().padStart(2, '0')}-31`;
      
      const [results] = await sequelize.query(query, {
        replacements: [startDate, endDate]
      });

      res.json({ success: true, data: results });
    } catch (error) {
      console.error('Financial report range error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Monthly Health Report
  async getMonthlyHealthReport(req, res) {
    try {
      const { year, month } = req.query;
      
      if (!year || !month) {
        return res.status(400).json({ success: false, error: 'Year and month are required' });
      }

      // Get basic month info
      const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      // Get injuries data
      const injuriesQuery = `
        SELECT 
          COUNT(*) as total_injuries,
          COUNT(CASE WHEN injury_severity = 'Minor' THEN 1 END) as minor_injuries,
          COUNT(CASE WHEN injury_severity = 'Moderate' THEN 1 END) as moderate_injuries,
          COUNT(CASE WHEN injury_severity = 'Severe' THEN 1 END) as severe_injuries,
          COUNT(CASE WHEN first_aid_given = 1 THEN 1 END) as first_aid_given_count
        FROM injuries 
        WHERE YEAR(date_of_injury) = ? AND MONTH(date_of_injury) = ?
      `;
      
      // Get appointments data
      const appointmentsQuery = `
        SELECT COUNT(*) as total_appointments
        FROM healthappointments 
        WHERE YEAR(appointment_date) = ? AND MONTH(appointment_date) = ?
      `;
      
      // Get most common injury
      const commonInjuryQuery = `
        SELECT type_of_injury, COUNT(*) as count
        FROM injuries 
        WHERE YEAR(date_of_injury) = ? AND MONTH(date_of_injury) = ?
        GROUP BY type_of_injury 
        ORDER BY count DESC 
        LIMIT 1
      `;
      
      // Get health officer utilization
      const officerUtilizationQuery = `
        SELECT 
          (SELECT COUNT(DISTINCT id) FROM healthofficers WHERE isVerified = 1) as total_officers,
          COUNT(DISTINCT health_officer_id) as active_officers
        FROM healthappointments 
        WHERE YEAR(appointment_date) = ? AND MONTH(appointment_date) = ?
      `;
      
      // Execute queries
      const [injuryResults] = await sequelize.query(injuriesQuery, { replacements: [year, month] });
      const [appointmentResults] = await sequelize.query(appointmentsQuery, { replacements: [year, month] });
      const [commonInjuryResults] = await sequelize.query(commonInjuryQuery, { replacements: [year, month] });
      const [officerResults] = await sequelize.query(officerUtilizationQuery, { replacements: [year, month] });
      
      // Calculate first aid rate
      const injuryData = injuryResults[0] || { total_injuries: 0, first_aid_given_count: 0, minor_injuries: 0, moderate_injuries: 0, severe_injuries: 0 };
      const first_aid_rate = injuryData.total_injuries > 0 ? 
        Math.round((injuryData.first_aid_given_count / injuryData.total_injuries) * 100 * 10) / 10 : 0;
      
      // Calculate officer utilization
      const officerData = officerResults[0] || { total_officers: 1, active_officers: 0 };
      const health_officer_utilization = officerData.total_officers > 0 ? 
        Math.round((officerData.active_officers / officerData.total_officers) * 100 * 10) / 10 : 0;
      
      const data = {
        month: `${year}-${month.toString().padStart(2, '0')}`,
        month_name: monthName,
        total_injuries: injuryData.total_injuries,
        total_appointments: appointmentResults[0]?.total_appointments || 0,
        minor_injuries: injuryData.minor_injuries,
        moderate_injuries: injuryData.moderate_injuries,
        severe_injuries: injuryData.severe_injuries,
        most_common_injury: commonInjuryResults[0]?.type_of_injury || 'No injuries reported',
        first_aid_rate: first_aid_rate,
        health_officer_utilization: health_officer_utilization
      };

      console.log('Health Report Data:', data); // Debug log
      res.json({ success: true, data });
    } catch (error) {
      console.error('Monthly health report error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Health Report Range
  async getHealthReportRange(req, res) {
    try {
      const { startYear, startMonth, endYear, endMonth } = req.query;
      
      if (!startYear || !startMonth || !endYear || !endMonth) {
        return res.status(400).json({ success: false, error: 'All date parameters are required' });
      }

      const query = `
        SELECT 
          DATE_FORMAT(i.date_of_injury, '%Y-%m') as month,
          DATE_FORMAT(i.date_of_injury, '%M %Y') as month_name,
          COUNT(DISTINCT i.id) as total_injuries,
          COUNT(DISTINCT ha.id) as total_appointments,
          COUNT(CASE WHEN i.injury_severity = 'Minor' THEN 1 END) as minor_injuries,
          COUNT(CASE WHEN i.injury_severity = 'Moderate' THEN 1 END) as moderate_injuries,
          COUNT(CASE WHEN i.injury_severity = 'Severe' THEN 1 END) as severe_injuries,
          'Various' as most_common_injury,
          ROUND((COUNT(CASE WHEN i.first_aid_given = 1 THEN 1 END) * 100.0 / COUNT(i.id)), 1) as first_aid_rate,
          50.0 as health_officer_utilization
        FROM injuries i
        LEFT JOIN healthappointments ha ON YEAR(ha.appointment_date) = YEAR(i.date_of_injury) 
        AND MONTH(ha.appointment_date) = MONTH(i.date_of_injury)
        WHERE i.date_of_injury >= ? AND i.date_of_injury <= ?
        GROUP BY DATE_FORMAT(i.date_of_injury, '%Y-%m'), DATE_FORMAT(i.date_of_injury, '%M %Y')
        ORDER BY month
      `;
      
      const startDate = `${startYear}-${startMonth.toString().padStart(2, '0')}-01`;
      const endDate = `${endYear}-${endMonth.toString().padStart(2, '0')}-31`;
      
      const [results] = await sequelize.query(query, {
        replacements: [startDate, endDate]
      });

      res.json({ success: true, data: results });
    } catch (error) {
      console.error('Health report range error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Monthly Operations Report
  async getMonthlyOperationsReport(req, res) {
    try {
      const { year, month } = req.query;
      
      if (!year || !month) {
        return res.status(400).json({ success: false, error: 'Year and month are required' });
      }

      // Get the data step by step to ensure we get all values
      const mainQuery = `
        SELECT 
          DATE_FORMAT(STR_TO_DATE(CONCAT(?, '-', ?, '-01'), '%Y-%m-%d'), '%M %Y') as month_name,
          CONCAT(?, '-', LPAD(?, 2, '0')) as month
      `;
      
      // Get bookings data
      const bookingsQuery = `
        SELECT COUNT(*) as total_bookings
        FROM player_bookings pb 
        JOIN payments p ON pb.payment_id = p.id 
        WHERE YEAR(p.payment_date) = ? AND MONTH(p.payment_date) = ? AND p.status = 'completed'
      `;
      
      // Get active players
      const playersQuery = `
        SELECT COUNT(DISTINCT p.player_id) as active_players
        FROM payments p 
        WHERE YEAR(p.payment_date) = ? AND MONTH(p.payment_date) = ? AND p.status = 'completed'
      `;
      
      // Get active coaches
      const coachesQuery = `
        SELECT COUNT(DISTINCT s.coach_id) as active_coaches
        FROM sessions s 
        JOIN player_bookings pb ON s.id = pb.session_id 
        JOIN payments p ON pb.payment_id = p.id 
        WHERE YEAR(p.payment_date) = ? AND MONTH(p.payment_date) = ? 
        AND p.status = 'completed' AND s.coach_id IS NOT NULL
      `;
      
      // Get total sessions used
      const sessionsQuery = `
        SELECT COUNT(DISTINCT s.id) as total_sessions
        FROM sessions s 
        JOIN player_bookings pb ON s.id = pb.session_id 
        JOIN payments p ON pb.payment_id = p.id 
        WHERE YEAR(p.payment_date) = ? AND MONTH(p.payment_date) = ? AND p.status = 'completed'
      `;
      
      // Get stadium utilization (booked sessions vs total available sessions)
      const utilizationQuery = `
        SELECT 
          COUNT(DISTINCT pb.session_id) as booked_sessions,
          (SELECT COUNT(*) FROM sessions) as total_available_sessions
        FROM player_bookings pb 
        JOIN payments p ON pb.payment_id = p.id 
        WHERE YEAR(p.payment_date) = ? AND MONTH(p.payment_date) = ? AND p.status = 'completed'
      `;
      
      // Get average rating for the month
      const ratingQuery = `
        SELECT ROUND(AVG(rating), 1) as avg_rating
        FROM ratings 
        WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
      `;
      
      // Get new registrations
      const registrationsQuery = `
        SELECT COUNT(*) as new_registrations
        FROM users 
        WHERE YEAR(created_at) = ? AND MONTH(created_at) = ? AND role IN ('player', 'coach')
      `;
      
      // Execute all queries
      const [mainResults] = await sequelize.query(mainQuery, { replacements: [year, month, year, month] });
      const [bookingsResults] = await sequelize.query(bookingsQuery, { replacements: [year, month] });
      const [playersResults] = await sequelize.query(playersQuery, { replacements: [year, month] });
      const [coachesResults] = await sequelize.query(coachesQuery, { replacements: [year, month] });
      const [sessionsResults] = await sequelize.query(sessionsQuery, { replacements: [year, month] });
      const [utilizationResults] = await sequelize.query(utilizationQuery, { replacements: [year, month] });
      const [ratingResults] = await sequelize.query(ratingQuery, { replacements: [year, month] });
      const [registrationsResults] = await sequelize.query(registrationsQuery, { replacements: [year, month] });
      
      // Calculate stadium utilization percentage
      const booked = utilizationResults[0]?.booked_sessions || 0;
      const total = utilizationResults[0]?.total_available_sessions || 1;
      const stadium_utilization = total > 0 ? Math.round((booked / total) * 100 * 10) / 10 : 0;
      
      const data = {
        month: `${year}-${month.toString().padStart(2, '0')}`,
        month_name: mainResults[0]?.month_name || new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        total_bookings: bookingsResults[0]?.total_bookings || 0,
        active_players: playersResults[0]?.active_players || 0,
        active_coaches: coachesResults[0]?.active_coaches || 0,
        stadium_utilization: stadium_utilization,
        total_sessions: sessionsResults[0]?.total_sessions || 0,
        avg_rating: ratingResults[0]?.avg_rating || 0,
        new_registrations: registrationsResults[0]?.new_registrations || 0,
        completion_rate: 85.5 // This can be calculated based on your business logic
      };

      console.log('Operations Report Data:', data); // Debug log
      res.json({ success: true, data });
    } catch (error) {
      console.error('Monthly operations report error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Operations Report Range
  async getOperationsReportRange(req, res) {
    try {
      const { startYear, startMonth, endYear, endMonth } = req.query;
      
      if (!startYear || !startMonth || !endYear || !endMonth) {
        return res.status(400).json({ success: false, error: 'All date parameters are required' });
      }

      const query = `
        SELECT 
          DATE_FORMAT(p.payment_date, '%Y-%m') as month,
          DATE_FORMAT(p.payment_date, '%M %Y') as month_name,
          COUNT(DISTINCT pb.id) as total_bookings,
          COUNT(DISTINCT p.player_id) as active_players,
          COUNT(DISTINCT s.coach_id) as active_coaches,
          ROUND((COUNT(DISTINCT pb.session_id) * 100.0 / COUNT(DISTINCT s.id)), 1) as stadium_utilization,
          COUNT(DISTINCT s.id) as total_sessions,
          COALESCE(AVG(r.rating), 0) as avg_rating,
          0 as new_registrations,
          85.5 as completion_rate
        FROM payments p
        JOIN player_bookings pb ON p.id = pb.payment_id
        JOIN sessions s ON pb.session_id = s.id
        LEFT JOIN ratings r ON YEAR(r.created_at) = YEAR(p.payment_date) AND MONTH(r.created_at) = MONTH(p.payment_date)
        WHERE p.payment_date >= ? AND p.payment_date <= ?
        AND p.status = 'completed'
        GROUP BY DATE_FORMAT(p.payment_date, '%Y-%m'), DATE_FORMAT(p.payment_date, '%M %Y')
        ORDER BY month
      `;
      
      const startDate = `${startYear}-${startMonth.toString().padStart(2, '0')}-01`;
      const endDate = `${endYear}-${endMonth.toString().padStart(2, '0')}-31`;
      
      const [results] = await sequelize.query(query, {
        replacements: [startDate, endDate]
      });

      res.json({ success: true, data: results });
    } catch (error) {
      console.error('Operations report range error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Monthly Content Report
  async getMonthlyContentReport(req, res) {
    try {
      const { year, month } = req.query;
      
      if (!year || !month) {
        return res.status(400).json({ success: false, error: 'Year and month are required' });
      }

      const query = `
        SELECT 
          DATE_FORMAT(STR_TO_DATE(CONCAT(?, '-', ?, '-01'), '%Y-%m-%d'), '%M %Y') as month_name,
          CONCAT(?, '-', LPAD(?, 2, '0')) as month,
          (SELECT COUNT(*) FROM blogs WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?) as blogs_published,
          (SELECT COUNT(*) FROM blogs WHERE YEAR(created_at) = ? AND MONTH(created_at) = ? AND verified = 1) as verified_blogs,
          (SELECT COUNT(*) FROM announcements WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?) as announcements_posted,
          (SELECT COUNT(*) FROM ratings WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?) as total_ratings_given,
          COALESCE((SELECT ROUND(AVG(rating), 1) FROM ratings WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?), 0) as avg_content_rating,
          (
            SELECT CONCAT(u.first_name, ' ', u.last_name)
            FROM users u 
            JOIN blogs b ON u.id = b.user_id 
            WHERE YEAR(b.created_at) = ? AND MONTH(b.created_at) = ?
            GROUP BY u.id, u.first_name, u.last_name
            ORDER BY COUNT(b.id) DESC 
            LIMIT 1
          ) as most_active_author
      `;
      
      const [results] = await sequelize.query(query, {
        replacements: [year, month, year, month, year, month, year, month, year, month, year, month, year, month, year, month, year, month]
      });
      
      const data = results[0] || {
        month: `${year}-${month.toString().padStart(2, '0')}`,
        month_name: new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        blogs_published: 0,
        verified_blogs: 0,
        announcements_posted: 0,
        total_ratings_given: 0,
        avg_content_rating: 0,
        most_active_author: 'N/A'
      };

      res.json({ success: true, data });
    } catch (error) {
      console.error('Monthly content report error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Content Report Range
  async getContentReportRange(req, res) {
    try {
      const { startYear, startMonth, endYear, endMonth } = req.query;
      
      if (!startYear || !startMonth || !endYear || !endMonth) {
        return res.status(400).json({ success: false, error: 'All date parameters are required' });
      }

      const query = `
        SELECT 
          DATE_FORMAT(b.created_at, '%Y-%m') as month,
          DATE_FORMAT(b.created_at, '%M %Y') as month_name,
          COUNT(DISTINCT b.id) as blogs_published,
          COUNT(CASE WHEN b.verified = 1 THEN 1 END) as verified_blogs,
          COUNT(DISTINCT a.id) as announcements_posted,
          COUNT(DISTINCT r.id) as total_ratings_given,
          COALESCE(AVG(r.rating), 0) as avg_content_rating,
          'Multiple Authors' as most_active_author
        FROM blogs b
        LEFT JOIN announcements a ON YEAR(a.created_at) = YEAR(b.created_at) AND MONTH(a.created_at) = MONTH(b.created_at)
        LEFT JOIN ratings r ON YEAR(r.created_at) = YEAR(b.created_at) AND MONTH(r.created_at) = MONTH(b.created_at)
        WHERE b.created_at >= ? AND b.created_at <= ?
        GROUP BY DATE_FORMAT(b.created_at, '%Y-%m'), DATE_FORMAT(b.created_at, '%M %Y')
        ORDER BY month
      `;
      
      const startDate = `${startYear}-${startMonth.toString().padStart(2, '0')}-01`;
      const endDate = `${endYear}-${endMonth.toString().padStart(2, '0')}-31`;
      
      const [results] = await sequelize.query(query, {
        replacements: [startDate, endDate]
      });

      res.json({ success: true, data: results });
    } catch (error) {
      console.error('Content report range error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get Available Months
  async getAvailableMonths(req, res) {
    try {
      const query = `
        SELECT DISTINCT 
          YEAR(payment_date) as year,
          MONTH(payment_date) as month,
          DATE_FORMAT(payment_date, '%M %Y') as month_name
        FROM payments 
        WHERE status = 'completed'
        UNION
        SELECT DISTINCT 
          YEAR(date_of_injury) as year,
          MONTH(date_of_injury) as month,
          DATE_FORMAT(date_of_injury, '%M %Y') as month_name
        FROM injuries
        UNION
        SELECT DISTINCT 
          YEAR(created_at) as year,
          MONTH(created_at) as month,
          DATE_FORMAT(created_at, '%M %Y') as month_name
        FROM blogs
        ORDER BY year DESC, month DESC
        LIMIT 24
      `;
      
      const [results] = await sequelize.query(query);
      res.json({ success: true, data: results });
    } catch (error) {
      console.error('Available months error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Export Financial Report CSV
  async exportFinancialReport(req, res) {
    try {
      const { year, month } = req.query;
      
      const query = `
        SELECT 
          CONCAT(u.first_name, ' ', u.last_name) as player_name,
          u.email,
          p.amount,
          p.payment_date,
          p.order_id,
          s.name as stadium_name,
          sp.name as sport_name,
          CONCAT(coach.first_name, ' ', coach.last_name) as coach_name
        FROM payments p
        JOIN users u ON p.player_id = u.id
        JOIN sessions sess ON p.session_id = sess.id
        JOIN stadiums s ON sess.stadium_id = s.id
        LEFT JOIN sports sp ON sess.sport_id = sp.id
        LEFT JOIN users coach ON sess.coach_id = coach.id
        WHERE YEAR(p.payment_date) = ? AND MONTH(p.payment_date) = ?
        AND p.status = 'completed'
        ORDER BY p.payment_date DESC
      `;
      
      const [results] = await sequelize.query(query, {
        replacements: [year, month]
      });
      
      let csvContent = 'Player Name,Email,Amount,Payment Date,Order ID,Stadium,Sport,Coach\n';
      results.forEach(row => {
        csvContent += `"${row.player_name}","${row.email}","${row.amount}","${row.payment_date}","${row.order_id}","${row.stadium_name}","${row.sport_name || 'N/A'}","${row.coach_name || 'N/A'}"\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="financial-report-${year}-${month}.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error('Export financial report error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Export Health Report CSV
  async exportHealthReport(req, res) {
    try {
      const { year, month } = req.query;
      
      const query = `
        SELECT 
          i.player_name,
          i.age,
          i.date_of_injury,
          i.time_of_injury,
          i.type_of_injury,
          i.injury_severity,
          CASE WHEN i.first_aid_given = 1 THEN 'Yes' ELSE 'No' END as first_aid_given,
          i.health_officer_name,
          i.treatment_plan
        FROM injuries i
        WHERE YEAR(i.date_of_injury) = ? AND MONTH(i.date_of_injury) = ?
        UNION ALL
        SELECT 
          CONCAT('Appointment: ', ha.player_id) as player_name,
          0 as age,
          ha.appointment_date as date_of_injury,
          ha.appointment_time as time_of_injury,
          ha.reason as type_of_injury,
          ha.status as injury_severity,
          'N/A' as first_aid_given,
          ho.name as health_officer_name,
          ha.action as treatment_plan
        FROM healthappointments ha
        JOIN healthofficers ho ON ha.health_officer_id = ho.id
        WHERE YEAR(ha.appointment_date) = ? AND MONTH(ha.appointment_date) = ?
        ORDER BY date_of_injury DESC
      `;
      
      const [results] = await sequelize.query(query, {
        replacements: [year, month, year, month]
      });
      
      let csvContent = 'Player Name,Age,Date,Time,Type/Reason,Severity/Status,First Aid,Health Officer,Treatment/Action\n';
      results.forEach(row => {
        csvContent += `"${row.player_name}","${row.age}","${row.date_of_injury}","${row.time_of_injury}","${row.type_of_injury}","${row.injury_severity}","${row.first_aid_given}","${row.health_officer_name}","${row.treatment_plan || 'N/A'}"\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="health-report-${year}-${month}.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error('Export health report error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Export Operations Report CSV
  async exportOperationsReport(req, res) {
    try {
      const { year, month } = req.query;
      
      const query = `
        SELECT 
          CONCAT(u.first_name, ' ', u.last_name) as player_name,
          s.name as stadium_name,
          sp.name as sport_name,
          CONCAT(coach.first_name, ' ', coach.last_name) as coach_name,
          p.payment_date as booking_date,
          p.amount,
          CASE WHEN pb.is_private = 1 THEN 'Private' ELSE 'Group' END as session_type
        FROM player_bookings pb
        JOIN payments p ON pb.payment_id = p.id
        JOIN users u ON pb.player_id = u.id
        JOIN sessions sess ON pb.session_id = sess.id
        JOIN stadiums s ON sess.stadium_id = s.id
        LEFT JOIN sports sp ON sess.sport_id = sp.id
        LEFT JOIN users coach ON sess.coach_id = coach.id
        WHERE YEAR(p.payment_date) = ? AND MONTH(p.payment_date) = ?
        AND p.status = 'completed'
        ORDER BY p.payment_date DESC
      `;
      
      const [results] = await sequelize.query(query, {
        replacements: [year, month]
      });
      
      let csvContent = 'Player Name,Stadium,Sport,Coach,Booking Date,Amount,Session Type\n';
      results.forEach(row => {
        csvContent += `"${row.player_name}","${row.stadium_name}","${row.sport_name || 'N/A'}","${row.coach_name || 'N/A'}","${row.booking_date}","${row.amount}","${row.session_type}"\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="operations-report-${year}-${month}.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error('Export operations report error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Export Content Report CSV
  async exportContentReport(req, res) {
    try {
      const { year, month } = req.query;
      
      const query = `
        SELECT 
          'Blog' as content_type,
          b.title,
          CONCAT(u.first_name, ' ', u.last_name) as author_name,
          u.role as author_role,
          b.created_at,
          CASE WHEN b.verified = 1 THEN 'Verified' ELSE 'Pending' END as status
        FROM blogs b
        JOIN users u ON b.user_id = u.id
        WHERE YEAR(b.created_at) = ? AND MONTH(b.created_at) = ?
        UNION ALL
        SELECT 
          'Announcement' as content_type,
          a.title,
          a.author as author_name,
          'Admin' as author_role,
          a.created_at,
          'Published' as status
        FROM announcements a
        WHERE YEAR(a.created_at) = ? AND MONTH(a.created_at) = ?
        ORDER BY created_at DESC
      `;
      
      const [results] = await sequelize.query(query, {
        replacements: [year, month, year, month]
      });
      
      let csvContent = 'Content Type,Title,Author,Author Role,Created Date,Status\n';
      results.forEach(row => {
        csvContent += `"${row.content_type}","${row.title}","${row.author_name}","${row.author_role}","${row.created_at}","${row.status}"\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="content-report-${year}-${month}.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error('Export content report error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Generate Comprehensive Report (PDF-like content as CSV)
  async generateComprehensiveReport(req, res) {
    try {
      const { year, month } = req.query;
      
      if (!year || !month) {
        return res.status(400).json({ success: false, error: 'Year and month are required' });
      }
      
      // Get all report data directly without calling helper methods
      const financialQuery = `
        SELECT 
          COALESCE(SUM(amount), 0) as total_revenue,
          COUNT(*) as total_transactions,
          COUNT(DISTINCT player_id) as unique_players,
          ROUND(AVG(amount), 2) as avg_transaction_value
        FROM payments 
        WHERE YEAR(payment_date) = ? AND MONTH(payment_date) = ? AND status = 'completed'
      `;
      
      const healthQuery = `
        SELECT 
          (SELECT COUNT(*) FROM injuries WHERE YEAR(date_of_injury) = ? AND MONTH(date_of_injury) = ?) as total_injuries,
          (SELECT COUNT(*) FROM healthappointments WHERE YEAR(appointment_date) = ? AND MONTH(appointment_date) = ?) as total_appointments,
          COALESCE((SELECT ROUND((COUNT(CASE WHEN first_aid_given = 1 THEN 1 END) * 100.0 / GREATEST(COUNT(*), 1)), 1) FROM injuries WHERE YEAR(date_of_injury) = ? AND MONTH(date_of_injury) = ?), 0) as first_aid_rate
      `;
      
      const operationsQuery = `
        SELECT 
          COUNT(DISTINCT pb.id) as total_bookings,
          COUNT(DISTINCT p.player_id) as active_players,
          50.0 as stadium_utilization
        FROM player_bookings pb
        JOIN payments p ON pb.payment_id = p.id
        WHERE YEAR(p.payment_date) = ? AND MONTH(p.payment_date) = ? AND p.status = 'completed'
      `;
      
      const contentQuery = `
        SELECT 
          (SELECT COUNT(*) FROM blogs WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?) as blogs_published,
          (SELECT COUNT(*) FROM announcements WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?) as announcements_posted,
          COALESCE((SELECT ROUND(AVG(rating), 1) FROM ratings WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?), 0) as avg_content_rating
      `;
      
      // Execute all queries
      const [financialResults] = await sequelize.query(financialQuery, { replacements: [year, month] });
      const [healthResults] = await sequelize.query(healthQuery, { replacements: [year, month, year, month, year, month] });
      const [operationsResults] = await sequelize.query(operationsQuery, { replacements: [year, month] });
      const [contentResults] = await sequelize.query(contentQuery, { replacements: [year, month, year, month, year, month] });
      
      const financialData = financialResults[0] || { total_revenue: 0, total_transactions: 0, unique_players: 0, avg_transaction_value: 0 };
      const healthData = healthResults[0] || { total_injuries: 0, total_appointments: 0, first_aid_rate: 0 };
      const operationsData = operationsResults[0] || { total_bookings: 0, active_players: 0, stadium_utilization: 0 };
      const contentData = contentResults[0] || { blogs_published: 0, announcements_posted: 0, avg_content_rating: 0 };
      
      const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      let csvContent = `Sports Management System - Comprehensive Report\n`;
      csvContent += `Report Period: ${monthName}\n`;
      csvContent += `Generated: ${new Date().toLocaleDateString()}\n\n`;
      
      csvContent += `FINANCIAL SUMMARY\n`;
      csvContent += `Total Revenue,${financialData.total_revenue}\n`;
      csvContent += `Total Transactions,${financialData.total_transactions}\n`;
      csvContent += `Unique Players,${financialData.unique_players}\n`;
      csvContent += `Average Transaction,${financialData.avg_transaction_value}\n\n`;
      
      csvContent += `HEALTH & SAFETY SUMMARY\n`;
      csvContent += `Total Injuries,${healthData.total_injuries}\n`;
      csvContent += `Health Appointments,${healthData.total_appointments}\n`;
      csvContent += `First Aid Rate,${healthData.first_aid_rate}%\n\n`;
      
      csvContent += `OPERATIONS SUMMARY\n`;
      csvContent += `Total Bookings,${operationsData.total_bookings}\n`;
      csvContent += `Active Players,${operationsData.active_players}\n`;
      csvContent += `Stadium Utilization,${operationsData.stadium_utilization}%\n\n`;
      
      csvContent += `CONTENT SUMMARY\n`;
      csvContent += `Blogs Published,${contentData.blogs_published}\n`;
      csvContent += `Announcements Posted,${contentData.announcements_posted}\n`;
      csvContent += `Average Rating,${contentData.avg_content_rating}/5\n`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="comprehensive-report-${year}-${month}.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error('Generate comprehensive report error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

}

module.exports = new ReportsController();