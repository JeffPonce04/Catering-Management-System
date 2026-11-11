'use strict';

// Load environment variables before importing routes, models, or the DB pool.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const db = require('./config/database');

const app = express();
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Permit non-browser clients without an Origin header; enforce allowlist for browsers.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/api/auth', authRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

app.get('/health/ready', async (req, res) => {
  try {
    await db.promisePool.query('SELECT 1');
    return res.status(200).json({ status: 'OK', database: 'connected' });
  } catch (error) {
    console.error('Readiness database check failed:', error.message);
    return res.status(503).json({ status: 'ERROR', database: 'unavailable' });
  }
});

app.use((err, req, res, next) => {
  console.error('Request error:', err.message);
  if (res.headersSent) return next(err);
  return res.status(err.message === 'Origin not allowed by CORS' ? 403 : 500).json({
    success: false,
    message: err.message === 'Origin not allowed by CORS'
      ? 'Origin not allowed'
      : 'Something went wrong!',
  });
});

const PORT = Number(process.env.PORT || 5000);
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down gracefully`);
  server.close(async () => {
    try {
      await db.promisePool.end();
      process.exit(0);
    } catch (error) {
      console.error('Database pool shutdown failed:', error.message);
      process.exit(1);
    }
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
