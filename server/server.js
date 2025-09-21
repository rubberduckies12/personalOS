const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Import middleware
const { authenticateUser } = require('./middleware/auth');

// Import routes
const registerRoute = require('./routes/register');
const loginRoute = require('./routes/login');
const aiRoute = require('./routes/ai');
const tasksRoute = require('./routes/tasks');
const projectsRoute = require('./routes/projects');
const goalsRoute = require('./routes/goals');
const readingRoute = require('./routes/reading');
const skillsRoute = require('./routes/skills');
const financesRoute = require('./routes/finances');

// Initialize Express app
const app = express();

// ========================================
// ENVIRONMENT & CONFIGURATION
// ========================================

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/personalos';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
if (NODE_ENV === 'production') {
  requiredEnvVars.push('OPENAI_API_KEY', 'CLIENT_URL');
}

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// ========================================
// SECURITY MIDDLEWARE (Applied First)
// ========================================

// Enable trust proxy for accurate IP addresses behind reverse proxies
app.set('trust proxy', 1);

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      CLIENT_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'https://your-production-domain.com' // Add your production domain
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies and auth headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'user-id',
    'X-API-Key'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Rate limiting
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message, retryAfter: windowMs },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting in development
    skip: () => NODE_ENV === 'development'
  });
};

// Global rate limiting
app.use('/api/', createRateLimit(
  15 * 60 * 1000, // 15 minutes
  NODE_ENV === 'production' ? 1000 : 10000, // 1000 requests per 15 min in prod
  'Too many requests from this IP, please try again later'
));

// Stricter rate limiting for auth endpoints
app.use('/api/register', createRateLimit(
  60 * 60 * 1000, // 1 hour
  5, // 5 registration attempts per hour
  'Too many registration attempts, please try again later'
));

app.use('/api/login', createRateLimit(
  15 * 60 * 1000, // 15 minutes
  10, // 10 login attempts per 15 minutes
  'Too many login attempts, please try again later'
));

// Very strict rate limiting for AI endpoints
app.use('/api/ai', createRateLimit(
  60 * 1000, // 1 minute
  NODE_ENV === 'production' ? 20 : 100, // 20 AI requests per minute in prod
  'AI request rate limit exceeded, please slow down'
));

// Data sanitization
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(xss()); // Clean user input from malicious HTML
app.use(hpp()); // Prevent HTTP Parameter Pollution

// ========================================
// GENERAL MIDDLEWARE
// ========================================

// Compression for performance
app.use(compression({
  level: 6, // Compression level (0-9)
  threshold: 1024, // Only compress if response > 1KB
  filter: (req, res) => {
    // Don't compress if request includes 'x-no-compression' header
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression for all other responses
    return compression.filter(req, res);
  }
}));

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb', // Increase for file uploads
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging middleware
if (NODE_ENV === 'production') {
  // Create logs directory if it doesn't exist
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Production logging to file
  const accessLogStream = fs.createWriteStream(
    path.join(logsDir, 'access.log'),
    { flags: 'a' }
  );
  
  app.use(morgan('combined', { 
    stream: accessLogStream,
    // Only log errors in production
    skip: (req, res) => res.statusCode < 400
  }));
} else {
  // Development logging to console
  app.use(morgan('dev'));
}

// Health check endpoint (public)
app.get('/health', (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    node_version: process.version,
    memory_usage: process.memoryUsage(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  };
  
  try {
    res.status(200).json(healthcheck);
  } catch (error) {
    healthcheck.message = 'Service Unavailable';
    res.status(503).json(healthcheck);
  }
});

// API status endpoint (public)
app.get('/api/status', (req, res) => {
  res.json({
    status: 'operational',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: 'operational',
      ai: 'operational',
      tasks: 'operational',
      projects: 'operational',
      goals: 'operational',
      reading: 'operational',
      skills: 'operational',
      finances: 'operational'
    },
    features: {
      voice_chat: true,
      ai_analysis: true,
      file_uploads: true,
      real_time_sync: false // Add when implementing WebSockets
    }
  });
});

// ========================================
// PUBLIC ROUTES (No Authentication Required)
// ========================================

// Authentication routes
app.use('/api/register', registerRoute);
app.use('/api/login', loginRoute);

// ========================================
// PROTECTED ROUTES (Authentication Required)
// ========================================

// Apply authentication middleware to all protected routes
app.use('/api/ai', authenticateUser, aiRoute);
app.use('/api/tasks', authenticateUser, tasksRoute);
app.use('/api/projects', authenticateUser, projectsRoute);
app.use('/api/goals', authenticateUser, goalsRoute);
app.use('/api/reading', authenticateUser, readingRoute);
app.use('/api/skills', authenticateUser, skillsRoute);
app.use('/api/finances', authenticateUser, financesRoute);

// ========================================
// SERVE STATIC FILES (Production)
// ========================================

if (NODE_ENV === 'production') {
  // Serve static files from the React app build directory
  const buildPath = path.join(__dirname, '../client/build');
  
  if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath, {
      maxAge: '1y', // Cache static assets for 1 year
      etag: true,
      lastModified: true
    }));

    // Serve React app for all non-API routes
    app.get('*', (req, res) => {
      // Don't serve React app for API routes
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      
      res.sendFile(path.join(buildPath, 'index.html'), {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
    });
  } else {
    console.warn('⚠️  Client build directory not found. Static files will not be served.');
  }
}

// ========================================
// ERROR HANDLING MIDDLEWARE
// ========================================

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  // Log error for debugging
  console.error('Global Error Handler:', {
    error: err.message,
    stack: NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: Object.values(err.errors).map(e => e.message),
      code: 'VALIDATION_ERROR'
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format',
      code: 'INVALID_ID'
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: 'Duplicate entry',
      field: Object.keys(err.keyValue)[0],
      code: 'DUPLICATE_ERROR'
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED'
    });
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS policy violation',
      code: 'CORS_ERROR'
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    error: NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    code: 'INTERNAL_ERROR',
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ========================================
// DATABASE CONNECTION
// ========================================

const connectDB = async () => {
  try {
    const mongooseOptions = {
      // Connection options
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferMaxEntries: 0, // Disable mongoose buffering
      bufferCommands: false, // Disable mongoose buffering
      
      // Optimize for production
      ...(NODE_ENV === 'production' && {
        maxPoolSize: 50,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 10000,
      })
    };

    await mongoose.connect(MONGODB_URI, mongooseOptions);
    
    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    
    if (NODE_ENV === 'production') {
      // Exit process with failure in production
      process.exit(1);
    } else {
      // In development, log error but don't exit
      console.log('⚠️  Continuing without database connection (development mode)');
    }
  }
};

// ========================================
// GRACEFUL SHUTDOWN HANDLING
// ========================================

const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 ${signal} signal received. Starting graceful shutdown...`);
  
  // Close server
  server.close(async () => {
    console.log('✅ HTTP server closed');
    
    try {
      // Close database connection
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed');
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  });

  // Force close after 30 seconds
  setTimeout(() => {
    console.error('❌ Forceful shutdown due to timeout');
    process.exit(1);
  }, 30000);
};

// ========================================
// START SERVER
// ========================================

let server;

const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();
    
    // Start HTTP server
    server = app.listen(PORT, () => {
      console.log(`\n🚀 PersonalOS Server Running`);
      console.log(`📊 Environment: ${NODE_ENV}`);
      console.log(`🌐 Server: http://localhost:${PORT}`);
      console.log(`💾 Database: ${mongoose.connection.host}`);
      console.log(`📅 Started: ${new Date().toISOString()}`);
      
      if (NODE_ENV === 'development') {
        console.log(`\n📋 Available Endpoints:`);
        console.log(`   GET  /health              - Health check`);
        console.log(`   GET  /api/status          - API status`);
        console.log(`   POST /api/register        - User registration`);
        console.log(`   POST /api/login           - User login`);
        console.log(`   *    /api/ai/*            - AI endpoints (protected)`);
        console.log(`   *    /api/tasks/*         - Tasks endpoints (protected)`);
        console.log(`   *    /api/projects/*      - Projects endpoints (protected)`);
        console.log(`   *    /api/goals/*         - Goals endpoints (protected)`);
        console.log(`   *    /api/reading/*       - Reading endpoints (protected)`);
        console.log(`   *    /api/skills/*        - Skills endpoints (protected)`);
        console.log(`   *    /api/finances/*      - Finance endpoints (protected)`);
        console.log(`\n🔐 All endpoints except auth require authentication`);
      }
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// ========================================
// PROCESS EVENT HANDLERS
// ========================================

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  
  if (NODE_ENV === 'production') {
    gracefulShutdown('UNHANDLED_REJECTION');
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  
  if (NODE_ENV === 'production') {
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  }
});

// Handle process termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle PM2 graceful reload
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// ========================================
// START APPLICATION
// ========================================

startServer();

// Export app for testing
module.exports = app;