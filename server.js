const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const runRoutes = require('./routes/runRoutes');

// Load environment variables from .env file
dotenv.config();

const app = express();

// Standard middlewares
app.use(express.json());

// Enable CORS for all origins (development behavior)
app.use(cors());
console.log('[SERVER] CORS middleware loaded for all origins.');

// Mount auth and run routes
app.use('/api/auth', authRoutes);
app.use('/api/runs', runRoutes);

// API status / health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'up', service: 'PaceTrack Backend' });
});

// Define application port
const PORT = process.env.PORT || 5000;

/**
 * Bootstraps the application:
 * 1. Establishes Mongoose database connection
 * 2. Starts Express listener once connected
 */
const startServer = async () => {
  try {
    console.log('[SERVER] Initializing database connection...');
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`[SERVER] Success: PaceTrack backend listening on port ${PORT}`);
      console.log(`[SERVER] Auth routes registered at http://localhost:${PORT}/api/auth`);
    });
  } catch (error) {
    console.error('[SERVER] Critical: Startup failed. Unable to connect to MongoDB.');
    console.error(error.message);
    process.exit(1);
  }
};

startServer();
