const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
dotenv.config();

const { sequelize } = require('./config/db');

// Route Imports
const userRoutes = require('./routes/userRoutes');
const userManagementRoutes = require('./routes/userManagementRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const healthOfficerRoutes = require('./routes/healthOfficer.Routes');
const healthAppointmentRoutes = require('./routes/healthAppointment.routes');
const injuryRoutes = require('./routes/injury.routes');
const stadiumRoutes = require('./routes/stadiumRoutes');
const coachSessionRoutes = require('./routes/CoachSessionRoutes');
const approvalsRoutes = require('./routes/approvalsRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const adminBlogsRoutes = require('./routes/adminBlogsRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const bookingHistoryRoutes = require('./routes/bookingHistoryRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const complaintsRoutes = require('./routes/complaintsRoutes');
const maintenanceRequestsRoutes = require('./routes/maintenanceRequestsRoutes');
const playerPackageRoutes = require('./routes/playerPackageRoutes');
const waitlistRoutes = require('./routes/waitlistRoutes');
const achievementsRoutes = require('./routes/achievementsRoutes');
const stadiumOwnerAnnouncementRoutes = require('./routes/stadiumOwnerAnnouncementRoutes');
const revenueRoutes = require('./routes/revenueRoutes');
// Cloudinary Debug (Optional)
console.log('Cloudinary Config:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set (hidden)' : 'Not set'
});

// Multer Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'Uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Initialize Express
const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:4200',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static('Uploads'));

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/users', userManagementRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/healthOfficers', healthOfficerRoutes);
app.use('/api/appointments', healthAppointmentRoutes);
app.use('/api/injuries', injuryRoutes);
app.use('/api/stadiums', stadiumRoutes);
app.use('/api/coach-sessions', coachSessionRoutes);
app.use('/approvals', approvalsRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/adminblogs', adminBlogsRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/booking-history', bookingHistoryRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/stadium-owner', maintenanceRequestsRoutes);
app.use('/api/player-packages', playerPackageRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api', achievementsRoutes);
app.use('/api/stadium-owner-announcements', stadiumOwnerAnnouncementRoutes);
app.use('/api/revenue', revenueRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Sports App API is running');
});

// Database Connection
(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');

    await sequelize.sync({ alter: true });
    console.log('✅ Models synced successfully');
  } catch (error) {
    console.error('❌ Unable to connect to database:', error);
  }
})();

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
