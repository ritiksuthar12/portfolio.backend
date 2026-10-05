const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(express.json());

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database connection middleware to ensure connection is ready before handling requests (crucial for Vercel Serverless)
app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (err) {
    console.warn('MongoDB connection attempt in request:', err.message);
  }
  next();
});

// Initial startup connection
connectDB();

// API Routes
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const skillRoutes = require('./routes/skillRoutes');
const messageRoutes = require('./routes/messageRoutes');
const resumeRoutes = require('./routes/resumeRoutes');

// Standard /api routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/contact', messageRoutes);
app.use('/api/resume', resumeRoutes);

// Rewritten routes without /api prefix (supports Vercel rewrites seamlessly)
app.use('/auth', authRoutes);
app.use('/projects', projectRoutes);
app.use('/skills', skillRoutes);
app.use('/contact', messageRoutes);
app.use('/resume', resumeRoutes);

// Health check endpoint
app.get(['/api/health', '/health'], (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    status: 'online',
    database: mongoose.connection.readyState === 1 ? 'connected (mongodb)' : 'local_fallback',
    timestamp: new Date().toISOString(),
    service: 'Ritik Suthar Portfolio API'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Export app for Vercel serverless deployment
module.exports = app;

// Only listen on port when running standalone directly (not when imported as a serverless function)
if (require.main === module && !process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Portfolio backend server running on http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
      console.error(`💡 Free port ${PORT} or kill the existing process and restart.\n`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
    }
  });
}
