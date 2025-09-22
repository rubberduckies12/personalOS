const express = require('express');
const router = express.Router();
const Account = require('../models/accountModel');
const UserPreferences = require('../models/userPreferencesModel');
const bcrypt = require('bcryptjs');

// Add middleware to parse JSON and handle CORS for this route
router.use(express.json({ limit: '10mb' }));
router.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
    errors.push('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
  }

  // Check for common passwords
  const commonPasswords = [
    'password', '123456', 'password123', 'admin', 'qwerty',
    'letmein', 'welcome', 'monkey', '1234567890'
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a more secure password');
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength: errors.length === 0 ? 'strong' : 
              errors.length <= 2 ? 'medium' : 'weak'
  };
};

// POST /api/register - Register new user
router.post('/', async (req, res) => {
  try {
    console.log('📝 Registration request received');

    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      acceptTerms = false
    } = req.body;

    // Validation
    const validationErrors = [];

    if (!firstName || firstName.trim().length < 2) {
      validationErrors.push('First name must be at least 2 characters long');
    }

    if (!lastName || lastName.trim().length < 2) {
      validationErrors.push('Last name must be at least 2 characters long');
    }

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      validationErrors.push('Please enter a valid email address');
    }

    if (!password) {
      validationErrors.push('Password is required');
    }

    if (password !== confirmPassword) {
      validationErrors.push('Passwords do not match');
    }

    if (!acceptTerms) {
      validationErrors.push('You must accept the terms and conditions');
    }

    // Password strength validation
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        validationErrors.push(...passwordValidation.errors);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }

    // Check if email already exists
    const normalizedEmail = email.toLowerCase().trim();
    const existingAccount = await Account.findOne({ email: normalizedEmail });
    
    if (existingAccount) {
      return res.status(409).json({
        error: 'An account with this email address already exists',
        code: 'EMAIL_EXISTS',
        details: ['An account with this email already exists']
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new account (simplified - no email verification)
    const accountData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      isEmailConfirmed: true, // Set to true since we're skipping verification
      createdAt: new Date(),
      lastLogin: null,
      isActive: true,
      registrationIP: req.ip || req.connection?.remoteAddress || 'unknown'
    };

    const account = new Account(accountData);
    await account.save();
    console.log('✅ Account created successfully:', account._id);

    // Create default user preferences
    try {
      const userPreferences = new UserPreferences({
        userId: account._id,
        reading: {
          yearlyGoal: 52,
          defaultPageTime: 3,
          preferredGenres: [],
          reminderSettings: {
            enabled: true,
            frequency: 'weekly',
            time: '18:00'
          }
        },
        tasks: {
          defaultPriority: 'medium',
          defaultDuration: 60,
          autoArchiveCompleted: false,
          reminderSettings: {
            enabled: true,
            beforeDeadline: 24
          }
        },
        goals: {
          defaultTimeframe: 'monthly',
          reviewFrequency: 'weekly'
        },
        dashboard: {
          defaultView: 'overview',
          showCompletedItems: true,
          itemsPerPage: 20
        },
        notifications: {
          email: true,
          push: true,
          sms: false
        },
        privacy: {
          publicProfile: false,
          shareReadingProgress: false,
          shareGoals: false
        }
      });

      await userPreferences.save();
      console.log('✅ User preferences created successfully');
    } catch (preferencesError) {
      console.warn('⚠️ Failed to create default user preferences:', preferencesError.message);
      // Don't fail registration if preferences creation fails
    }

    // Return success response (no email verification needed)
    const response = {
      message: 'Account created successfully! You can now log in.',
      code: 'REGISTRATION_SUCCESS',
      account: {
        id: account._id,
        firstName: account.firstName,
        lastName: account.lastName,
        email: account.email,
        isEmailConfirmed: account.isEmailConfirmed,
        createdAt: account.createdAt
      }
    };

    res.status(201).json(response);
    console.log(`🎉 New user registered: ${account.email}`);

  } catch (error) {
    console.error('❌ Registration error:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        error: 'An account with this email address already exists',
        code: 'EMAIL_EXISTS',
        details: ['An account with this email already exists']
      });
    }

    res.status(500).json({
      error: 'Registration failed. Please try again.',
      code: 'REGISTRATION_ERROR',
      details: ['Internal server error occurred']
    });
  }
});

// GET /api/register/check-email/:email - Check if email is available
router.get('/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({
        error: 'Please enter a valid email address',
        code: 'INVALID_EMAIL',
        available: false
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingAccount = await Account.findOne({ email: normalizedEmail });
    
    res.json({
      available: !existingAccount,
      email: normalizedEmail,
      message: existingAccount ? 'Email address is already registered' : 'Email address is available',
      code: existingAccount ? 'EMAIL_TAKEN' : 'EMAIL_AVAILABLE'
    });

  } catch (error) {
    console.error('❌ Email check error:', error);
    res.status(500).json({
      error: 'Failed to check email availability',
      code: 'EMAIL_CHECK_ERROR',
      available: false
    });
  }
});

module.exports = router;