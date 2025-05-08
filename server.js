const express = require('express');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();
const userRoutes = require('./routes/userRoutes');
const userManagementRoutes = require('./routes/userManagementRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const stadiumRoutes = require('./routes/stadiumRoutes');
const approvalsRoutes = require('./routes/approvalsRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const bookingHistoryRoutes = require('./routes/bookingHistoryRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const complaintsRoutes = require('./routes/complaintsRoutes');

const app = express();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'Uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

app.use(cors({
  origin: 'http://localhost:4200',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static('Uploads'));

app.use('/api/users', userRoutes);
app.use('/api/users', userManagementRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/stadiums', stadiumRoutes);
app.use('/approvals', approvalsRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/booking-history', bookingHistoryRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/complaints', complaintsRoutes);

app.get('/', (req, res) => {
  res.send('Sports App API is running');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});