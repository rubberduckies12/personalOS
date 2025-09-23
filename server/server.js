// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import routes (no auth middleware import needed here)
const registerRoute = require('./routes/register');
const loginRoute = require('./routes/login');
const tasksRoute = require('./routes/tasks');
const projectsRoute = require('./routes/projects');
const goalsRoute = require('./routes/goals');
const readingRoute = require('./routes/reading');
const skillsRoute = require('./routes/skills');
const financesRoute = require('./routes/finances');

const app = express();
const PORT = process.env.PORT || 5001;

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/personalos')
  .then(() => console.log('🔗 MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'user-id'],
  credentials: false,
  optionsSuccessStatus: 200
}));

// JSON parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`${req.method} ${req.path} from ${req.headers.origin || 'unknown'}`);
    console.log('🔑 Authorization header:', req.headers.authorization ? 'Present' : 'Missing');
  }
  next();
});

// Routes
app.get('/health', (req, res) => res.json({ status: 'OK' }));

// Public routes - NO AUTHENTICATION (handled in route files)
app.use('/api/register', registerRoute);
app.use('/api/login', loginRoute);

// Logout route - Public endpoint
app.post('/api/auth/logout', (req, res) => {
  console.log('🚪 Logout request received');
  res.json({ message: 'Logged out successfully' });
});

// Routes - AUTHENTICATION HANDLED IN INDIVIDUAL ROUTE FILES
app.use('/api/tasks', tasksRoute);
app.use('/api/projects', projectsRoute);
app.use('/api/goals', goalsRoute);
app.use('/api/reading', readingRoute);
app.use('/api/skills', skillsRoute);
app.use('/api/finances', financesRoute);

// 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;