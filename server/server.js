// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Import middleware and routes
const { authenticateUser } = require('./middleware/auth');
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

// CORS configuration - MUST BE FIRST
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'user-id'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Cookie parser
app.use(cookieParser());

// JSON parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`${req.method} ${req.path} from ${req.headers.origin || 'unknown'}`);
    console.log('🍪 Raw cookies on request:', req.headers.cookie);
    console.log('🍪 Parsed cookies:', req.cookies);
  }
  next();
});

// Routes
app.get('/health', (req, res) => res.json({ status: 'OK' }));

// Test routes
app.get('/api/test-cookie', (req, res) => {
  console.log('🧪 Setting test cookie');
  res.cookie('testCookie', 'testValue', {
    httpOnly: false,
    secure: false,
    sameSite: 'lax',
    maxAge: 60000,
    path: '/'
  });
  res.json({ message: 'Test cookie set' });
});

app.get('/api/read-cookies', (req, res) => {
  console.log('🧪 All cookies received:', req.cookies);
  res.json({ cookies: req.cookies });
});

// Public routes - NO AUTHENTICATION REQUIRED
app.use('/api/register', registerRoute);
app.use('/api/login', loginRoute);

// Logout route - MOVED AFTER LOGIN ROUTE AND WITH PROPER METHOD CHECK
app.post('/api/auth/logout', (req, res) => {
  console.log('🚪 Logout request received');
  
  // Clear both cookies with the same options used to set them
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  };
  
  res.clearCookie('token', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
  
  console.log('🍪 Cookies cleared');
  res.json({ message: 'Logged out successfully' });
});

// Protected routes - AUTHENTICATION REQUIRED
app.use('/api/tasks', authenticateUser, tasksRoute);
app.use('/api/projects', authenticateUser, projectsRoute);
app.use('/api/goals', authenticateUser, goalsRoute);
app.use('/api/reading', authenticateUser, readingRoute);
app.use('/api/skills', authenticateUser, skillsRoute);
app.use('/api/finances', authenticateUser, financesRoute);

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