const express = require('express');
const cors = require('cors');
require('dotenv').config();
const userRoutes = require('./routes/userRoutes');
<<<<<<< HEAD
const stadiumRoutes = require('./routes/stadiumRoutes');
const userManagementRoutes = require('./routes/userManagementRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const approvalsRoutes = require('./routes/approvalsRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
=======
const userManagementRoutes = require('./routes/userManagementRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const stadiumRoutes = require('./routes/stadiumRoutes'); // From Nethmi1 branch
const approvalsRoutes = require('./routes/approvalsRoutes'); // From dev branch
const announcementRoutes = require('./routes/announcementRoutes'); // From dev branch
const transactionRoutes = require('./routes/transactionRoutes');
const bookingHistoryRoutes = require('./routes/bookingHistoryRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
>>>>>>> dev

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:4200',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/users', userRoutes);
<<<<<<< HEAD
app.use('/api/stadiums', stadiumRoutes);
app.use('/api/users', userManagementRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/approvals', approvalsRoutes);
app.use('/api/announcements', announcementRoutes);
=======
app.use('/api/users', userManagementRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/stadiums', stadiumRoutes); // From Nethmi1 branch
app.use('/approvals', approvalsRoutes); // From dev branch
app.use('/api/announcements', announcementRoutes); // From dev branch
app.use('/api/transactions', transactionRoutes);
app.use('/api/booking-history', bookingHistoryRoutes);
app.use('/api/timetable', timetableRoutes);

>>>>>>> dev

// Base route
app.get('/', (req, res) => {
  res.send('Sports App API is running');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
