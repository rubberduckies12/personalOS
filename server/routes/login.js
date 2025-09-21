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

// Rate limiting for password reset requests
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 reset attempts per hour
  message: {
    error: 'Too many password reset attempts, please try again in 1 hour',
    retryAfter: 60 * 60 * 1000
  }
});

// In-memory storage for failed login attempts (in production, use Redis)
const failedAttempts = new Map();
const resetTokens = new Map();

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

// Helper function to validate password strength
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength: errors.length === 0 ? 'strong' : 
              errors.length <= 2 ? 'medium' : 'weak'
  };
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

// POST /api/login - User login
router.post('/', loginLimiter, async (req, res) => {
  try {
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
        retryAfter: 24 * 60 * 60 * 1000 // 24 hours in ms
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

    // Generate tokens
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Update last login
    user.lastLoginAt = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    
    // Store refresh token (in production, use secure database storage)
    user.refreshToken = refreshToken;
    await user.save();

    // Set secure HTTP-only cookie for refresh token
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 30 days or 24 hours
    };

    res.cookie('refreshToken', refreshToken, cookieOptions);

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
      accessToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      tokenType: 'Bearer'
    });

    // Log successful login (for audit purposes)
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
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'your-refresh-secret');
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

// POST /api/login/logout - Logout user
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    const userId = req.headers['user-id'];

    // Clear refresh token from database
    if (refreshToken && userId) {
      await Account.findByIdAndUpdate(userId, {
        $unset: { refreshToken: 1 }
      });
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.json({
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Failed to logout',
      code: 'LOGOUT_ERROR'
    });
  }
});

// POST /api/login/register - User registration
router.post('/register', async (req, res) => {
  try {
    const {
      email,
      password,
      confirmPassword,
      firstName,
      lastName,
      acceptTerms = false
    } = req.body;

    // Input validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'All fields are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (!acceptTerms) {
      return res.status(400).json({
        error: 'You must accept the terms and conditions',
        code: 'TERMS_NOT_ACCEPTED'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        error: 'Passwords do not match',
        code: 'PASSWORD_MISMATCH'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Password does not meet security requirements',
        code: 'WEAK_PASSWORD',
        details: passwordValidation.errors
      });
    }

    // Check if user already exists
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await Account.findOne({ email: normalizedEmail });
    
    if (existingUser) {
      return res.status(409).json({
        error: 'An account with this email already exists',
        code: 'EMAIL_EXISTS'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = new Account({
      email: normalizedEmail,
      password: hashedPassword,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      status: 'active', // In production, you might want 'inactive' until email verification
      preferences: {
        theme: 'light',
        notifications: {
          email: true,
          push: false
        },
        privacy: {
          profileVisible: false,
          dataSharing: false
        }
      },
      createdAt: new Date(),
      registrationIP: req.ip || req.connection.remoteAddress
    });

    const savedUser = await newUser.save();

    // Generate tokens for immediate login
    const accessToken = generateToken(savedUser);
    const refreshToken = generateRefreshToken(savedUser);

    // Store refresh token
    savedUser.refreshToken = refreshToken;
    savedUser.lastLoginAt = new Date();
    savedUser.loginCount = 1;
    await savedUser.save();

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: savedUser._id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        fullName: savedUser.getFullName(),
        status: savedUser.status
      },
      accessToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      tokenType: 'Bearer'
    });

    console.log(`New user registered: ${savedUser.email} at ${new Date().toISOString()}`);

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      error: 'Failed to create account',
      code: 'REGISTRATION_ERROR'
    });
  }
});

// POST /api/login/forgot-password - Request password reset
router.post('/forgot-password', resetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
        code: 'MISSING_EMAIL'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await Account.findOne({ email: normalizedEmail });

    // Always return success for security (don't reveal if email exists)
    const response = {
      message: 'If an account with that email exists, a password reset link has been sent',
      code: 'RESET_SENT'
    };

    if (user && user.status === 'active') {
      // Generate reset token
      const resetToken = jwt.sign(
        { userId: user._id, email: user.email, type: 'password_reset' },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
      );

      // Store reset token (in production, store in database with expiration)
      resetTokens.set(resetToken, {
        userId: user._id,
        email: user.email,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      });

      // In production, send email with reset link
      console.log(`Password reset requested for: ${user.email}`);
      console.log(`Reset token: ${resetToken}`);
      console.log(`Reset link: ${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`);
    }

    res.json(response);

  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      error: 'Failed to process password reset request',
      code: 'RESET_REQUEST_ERROR'
    });
  }
});

// POST /api/login/reset-password - Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        error: 'Token and passwords are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        error: 'Passwords do not match',
        code: 'PASSWORD_MISMATCH'
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Password does not meet security requirements',
        code: 'WEAK_PASSWORD',
        details: passwordValidation.errors
      });
    }

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Invalid or expired reset token',
        code: 'INVALID_TOKEN'
      });
    }

    // Check if token exists in store and is not expired
    const tokenData = resetTokens.get(token);
    if (!tokenData || tokenData.expiresAt < new Date()) {
      return res.status(401).json({
        error: 'Reset token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Find user
    const user = await Account.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password and clear refresh tokens
    user.password = hashedPassword;
    user.refreshToken = undefined;
    user.passwordChangedAt = new Date();
    await user.save();

    // Remove used reset token
    resetTokens.delete(token);

    res.json({
      message: 'Password reset successful',
      code: 'PASSWORD_RESET_SUCCESS'
    });

    console.log(`Password reset completed for: ${user.email}`);

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      error: 'Failed to reset password',
      code: 'RESET_ERROR'
    });
  }
});

// GET /api/login/me - Get current user info (requires authentication)
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7);
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (jwtError) {
      return res.status(401).json({
        error: 'Invalid or expired access token',
        code: 'INVALID_TOKEN'
      });
    }

    const user = await Account.findById(decoded.userId).select('-password -refreshToken');
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
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
        loginCount: user.loginCount,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      error: 'Failed to get user information',
      code: 'USER_INFO_ERROR'
    });
  }
});

// POST /api/login/change-password - Change password (requires authentication)
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.headers['user-id'];

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        error: 'All password fields are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        error: 'New passwords do not match',
        code: 'PASSWORD_MISMATCH'
      });
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'New password does not meet security requirements',
        code: 'WEAK_PASSWORD',
        details: passwordValidation.errors
      });
    }

    const user = await Account.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        error: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear all refresh tokens
    user.password = hashedPassword;
    user.refreshToken = undefined;
    user.passwordChangedAt = new Date();
    await user.save();

    res.json({
      message: 'Password changed successfully',
      code: 'PASSWORD_CHANGED'
    });

    console.log(`Password changed for user: ${user.email}`);

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Failed to change password',
      code: 'CHANGE_PASSWORD_ERROR'
    });
  }
});

module.exports = router;