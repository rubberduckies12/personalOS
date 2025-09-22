const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const Account = require('../models/accountModel');

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many login attempts, please try again in 15 minutes',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === 'development';
  }
});

// In-memory storage for failed login attempts (in production, use Redis)
const failedAttempts = new Map();

// Helper function to generate JWT token
const generateToken = (user) => {
  const payload = {
    userId: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: 'PersonalOS',
    audience: 'PersonalOS-Users'
  });
};

// Helper function to generate refresh token
const generateRefreshToken = (user) => {
  const payload = {
    userId: user._id,
    type: 'refresh'
  };

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'your-refresh-secret', {
    expiresIn: '30d',
    issuer: 'PersonalOS',
    audience: 'PersonalOS-Users'
  });
};

// Helper function to track failed login attempts
const trackFailedAttempt = (identifier) => {
  const attempts = failedAttempts.get(identifier) || 0;
  failedAttempts.set(identifier, attempts + 1);
  
  // Clean up old entries after 24 hours
  setTimeout(() => {
    failedAttempts.delete(identifier);
  }, 24 * 60 * 60 * 1000);
  
  return attempts + 1;
};

// Helper function to check if account is locked
const isAccountLocked = (identifier) => {
  const attempts = failedAttempts.get(identifier) || 0;
  return attempts >= 5; // Lock after 5 failed attempts
};

// POST /api/login - User login ONLY
router.post('/', loginLimiter, async (req, res) => {
  try {
    console.log('🔐 Login attempt received');
    const { email, password, rememberMe = false } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check for account lockout
    if (isAccountLocked(normalizedEmail)) {
      return res.status(423).json({
        error: 'Account temporarily locked due to multiple failed login attempts',
        code: 'ACCOUNT_LOCKED',
        retryAfter: 24 * 60 * 60 * 1000
      });
    }

    // Find user by email
    const user = await Account.findOne({ email: normalizedEmail });
    
    if (!user) {
      trackFailedAttempt(normalizedEmail);
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if account is active
    if (user.status === 'suspended') {
      return res.status(403).json({
        error: 'Account has been suspended. Please contact support.',
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        error: 'Please verify your email address to activate your account',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      const attempts = trackFailedAttempt(normalizedEmail);
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
        attemptsRemaining: Math.max(0, 5 - attempts)
      });
    }

    // Clear failed attempts on successful login
    failedAttempts.delete(normalizedEmail);

    console.log('✅ Login successful, generating tokens...');

    // Generate tokens
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Update last login
    user.lastLoginAt = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    
    // Store refresh token
    user.refreshToken = refreshToken;
    await user.save();

    console.log('🍪 Setting cookies...');

    // Set secure HTTP-only cookies - REMOVED domain setting
    const cookieOptions = {
      httpOnly: true,
      secure: false, // Set to false for localhost development
      sameSite: 'lax', // Keep as 'lax' for cross-origin
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 30 days or 24 hours
      path: '/' // Ensure cookie is available for all paths
    };

    // Set BOTH cookies
    res.cookie('token', accessToken, cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);

    console.log(`🍪 Access token cookie set for user: ${user._id}`);
    console.log(`🍪 Refresh token cookie set for user: ${user._id}`);
    console.log(`🍪 Cookie options:`, cookieOptions);

    // Return user data and access token
    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.getFullName(),
        avatar: user.avatar,
        preferences: user.preferences,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        loginCount: user.loginCount
      },
      accessToken, // Keep this for compatibility
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      tokenType: 'Bearer'
    });

    // Log successful login
    console.log(`Successful login: ${user.email} at ${new Date().toISOString()}`);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'An error occurred during login',
      code: 'INTERNAL_ERROR'
    });
  }
});

// POST /api/login/refresh - Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token not provided',
        code: 'NO_REFRESH_TOKEN'
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Find user and verify refresh token
    const user = await Account.findById(decoded.userId);
    
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Check account status
    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'Account is not active',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // Generate new access token
    const newAccessToken = generateToken(user);

    // Update cookie
    res.cookie('token', newAccessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({
      accessToken: newAccessToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      tokenType: 'Bearer'
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Failed to refresh token',
      code: 'REFRESH_ERROR'
    });
  }
});

// REMOVE ALL THE OTHER ENDPOINTS (register, forgot-password, etc.)
// These should be in separate route files

module.exports = router;