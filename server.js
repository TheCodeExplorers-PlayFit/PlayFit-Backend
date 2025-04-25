const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();
const userRoutes = require('./routes/userRoutes');
const stadiumRoutes = require('./routes/stadiumRoutes');

const app = express();

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sports_app',
  port: process.env.DB_PORT || 3308,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Middleware
app.use(cors({
    origin: 'http://localhost:4200',
    credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/stadiums', stadiumRoutes);

// Base route
app.get('/', (req, res) => {
    res.send('Sports App API is running');
});

// API endpoint to GET all sessions data
app.get('/api/sessions', async (req, res) => {
    try {
        const query = 'SELECT * FROM sessions';
        const [results] = await pool.execute(query);
        res.status(200).json(results);
    } catch (err) {
        console.error('Error fetching sessions:', err);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});