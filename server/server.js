// Load environment variables FIRST (before any other imports)
require('dotenv').config();

// Add global error handlers RIGHT AFTER dotenv
process.on('unhandledRejection', (reason, promise) => {
  console.log('⚠️  Unhandled Rejection at:', promise, 'reason:', reason);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.log('❌ Uncaught Exception:', error);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const colors = require('colors');

// Import middleware
const { authenticateUser } = require('./middleware/auth');

// Import routes
const registerRoute = require('./routes/register');
const loginRoute = require('./routes/login');
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
const JWT_SECRET = process.env.JWT_SECRET;

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
if (NODE_ENV === 'production') {
  requiredEnvVars.push('CLIENT_URL');
}

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// ========================================
// DATABASE CONNECTION (FIRST)
// ========================================

const connectDB = async () => {
  try {
    // Disconnect if already connected
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }

    // REMOVE bufferCommands: false to allow buffering during startup
    const mongooseOptions = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      family: 4,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      w: 'majority'
    };

    console.log('🔄 Connecting to MongoDB...'.cyan);
    
    await mongoose.connect(MONGODB_URI, mongooseOptions);
    
    console.log(`🔗 MongoDB Connected:`.green.bold + ` ${mongoose.connection.host}`.cyan.bold);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    return true;

  } catch (error) {
    console.error('🔥 MongoDB connection failed:'.red.bold, error.message);
    
    if (NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.log('⚠️  Continuing without database connection (development mode)'.yellow);
      return false;
    }
  }
};

// ========================================
// SECURITY MIDDLEWARE (Applied After DB Connection)
// ========================================

const setupMiddleware = () => {
  // Health and monitoring
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // Enhanced CORS configuration
  app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        'http://localhost:3000'
      ];
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log('❌ CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Origin', 
      'X-Requested-With', 
      'Content-Type', 
      'Accept', 
      'Authorization', 
      'user-id',
      'Cache-Control'
    ],
    credentials: true, // Allow cookies
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
  }));

  // Add cookie parser middleware
  const cookieParser = require('cookie-parser');
  app.use(cookieParser());

  // Request logging and parsing
  app.use(morgan('combined', {
    format: ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"',
    stream: fs.createWriteStream(path.join(__dirname, 'logs', 'access.log'), { flags: 'a' })
  }));
  
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  

  // Rate limiting
  const createRateLimit = (windowMs, max, message) => rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/register', createRateLimit(15 * 60 * 1000, 5, 'Too many registration attempts'));
  app.use('/api/login', createRateLimit(15 * 60 * 1000, 10, 'Too many login attempts'));
  app.use('/api/', createRateLimit(15 * 60 * 1000, 1000, 'Too many requests'));

  // Security middleware
  app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Add CORS debugging middleware
  app.use((req, res, next) => {
    console.log(`🌐 Request: ${req.method} ${req.path}`);
    console.log(`🌐 Origin: ${req.headers.origin}`);
    console.log(`🌐 Headers: ${JSON.stringify(req.headers)}`);
    
    // Log CORS headers being set
    console.log(`🌐 CORS Headers Set:`, {
      'Access-Control-Allow-Origin': res.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': res.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': res.get('Access-Control-Allow-Headers'),
      'Access-Control-Allow-Credentials': res.get('Access-Control-Allow-Credentials')
    });
    
    next();
  });

  console.log('✅ Middleware setup completed');
};

// ========================================
// ROUTES SETUP
// ========================================

const setupRoutes = () => {
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
        tasks: 'operational',
        projects: 'operational',
        goals: 'operational',
        reading: 'operational',
        skills: 'operational',
        finances: 'operational'
      },
      features: {
        voice_chat: false,
        ai_analysis: false,
        file_uploads: true,
        real_time_sync: false
      }
    });
  });

  // Public routes
  app.use('/api/register', registerRoute);
  app.use('/api/login', loginRoute);

  // Protected routes
  app.use('/api/tasks', authenticateUser, tasksRoute);
  app.use('/api/projects', authenticateUser, projectsRoute);
  app.use('/api/goals', authenticateUser, goalsRoute);
  app.use('/api/reading', authenticateUser, readingRoute);
  app.use('/api/skills', authenticateUser, skillsRoute);
  app.use('/api/finances', authenticateUser, financesRoute);

  // Serve static files in production
  if (NODE_ENV === 'production') {
    const buildPath = path.join(__dirname, '../client/build');
    
    if (fs.existsSync(buildPath)) {
      app.use(express.static(buildPath, {
        maxAge: '1y',
        etag: true,
        lastModified: true
      }));

      app.get('*', (req, res) => {
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

  // Error handling middleware
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        error: 'API endpoint not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }
    next();
  });

  app.use((err, req, res, next) => {
    console.error('Global Error Handler:', {
      error: err.message,
      stack: NODE_ENV === 'development' ? err.stack : undefined,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

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

    res.status(err.status || 500).json({
      error: NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message,
      code: 'INTERNAL_ERROR',
      ...(NODE_ENV === 'development' && { stack: err.stack })
    });
  });
};

// ========================================
// GRACEFUL SHUTDOWN HANDLING
// ========================================

let server;

const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 ${signal} signal received. Starting graceful shutdown...`.yellow.bold);
  
  if (server) {
    server.close(async () => {
      console.log('✅ HTTP server closed'.green);
      
      try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed'.green);
        
        console.log('✅ Graceful shutdown completed'.green.bold);
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during graceful shutdown:'.red.bold, error);
        process.exit(1);
      }
    });

    setTimeout(() => {
      console.error('❌ Forceful shutdown due to timeout'.red.bold);
      process.exit(1);
    }, 30000);
  } else {
    console.log('✅ No server to close, exiting gracefully');
    process.exit(0);
  }
};

// ========================================
// START SERVER
// ========================================

const startServer = async () => {
  try {
    console.log('🚀 Starting PersonalOS Server...'.cyan.bold);
    
    // Step 1: Connect to database FIRST
    await connectDB();
    
    // Step 2: Setup middleware AFTER database connection
    setupMiddleware();
    
    // Step 3: Setup routes AFTER middleware
    setupRoutes();
    
    // Step 4: Start HTTP server
    server = app.listen(PORT, () => {
      console.log(`🔗 MongoDB Connected:`.green.bold + ` ${mongoose.connection.host}`.cyan.bold);
      console.log(`🚀 Server running on http://localhost:${PORT}`.green.bold);
      console.log(`🌟 Environment: ${NODE_ENV.toUpperCase()}`.cyan);
      console.log(`🎯 READY TO SERVE!`.green.bold);
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('❌ Server error:'.red.bold, error);
      
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`.red.bold);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:'.red.bold, error);
    process.exit(1);
  }
};

// ========================================
// PROCESS EVENT HANDLERS
// ========================================

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// ========================================
// START APPLICATION
// ========================================

startServer();

// Export app for testing
module.exports = app;