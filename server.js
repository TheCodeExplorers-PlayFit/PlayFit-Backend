// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const userRoutes = require('./routes/userRoutes');
const userManagementRoutes = require('./routes/userManagementRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const stadiumRoutes = require('./routes/stadiumRoutes'); // From Nethmi1 branch
const approvalsRoutes = require('./routes/approvalsRoutes'); // From dev branch
const announcementRoutes = require('./routes/announcementRoutes'); // From dev branch
const transactionRoutes = require('./routes/transactionRoutes')

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:4200',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/users', userManagementRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/stadiums', stadiumRoutes); // From Nethmi1 branch
app.use('/approvals', approvalsRoutes); // From dev branch
app.use('/api/announcements', announcementRoutes); // From dev branch
app.use('/api/transactions', transactionRoutes);

// Base route
app.get('/', (req, res) => {
  res.send('Sports App API is running');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});