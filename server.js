const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const sequelize = require('./config/db'); // ✅ New: DB connection
const userRoutes = require('./routes/userRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const { HealthOfficer, HealthAppointment } = require('./models');
const healthOfficerRoutes = require('./routes/healthOfficer.Routes');
const healthAppointmentRoutes = require('./routes/healthAppointment.routes');
const injuryRoutes = require('./routes/injury.routes');

//  Initialize app FIRST
const app = express();

// Load environment variables
dotenv.config();


// Middleware
app.use(cors({
  origin: 'http://localhost:4200',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/healthOfficers', healthOfficerRoutes);
app.use('/api/appointments', healthAppointmentRoutes);
app.use('/api/injuries', injuryRoutes);


// Base routeapp.use('/api/healthOfficers', healthOfficerRoutes)
app.get('/', (req, res) => {
  res.send('Sports App API is running');
});

// Database Connection and Sync
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