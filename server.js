const express = require('express');
const cors = require('cors');
require('dotenv').config();
const userRoutes = require('./routes/userRoutes');
const stadiumRoutes = require('./routes/stadiumRoutes');
const userManagementRoutes = require('./routes/userManagementRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const approvalsRoutes = require('./routes/approvalsRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const bookingHistoryRoutes = require('./routes/bookingHistoryRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const complaintsRoutes = require('./routes/complaintsRoutes');

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:4200',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/users', userRoutes); // Base user routes
app.use('/api/users', userManagementRoutes); // Additional user management routes (note: same path, may need adjustment)
app.use('/api/stadiums', stadiumRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/approvals', approvalsRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/booking-history', bookingHistoryRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/complaints', complaintsRoutes);

// Base route
app.get('/', (req, res) => {
  res.send('Sports App API is running');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});