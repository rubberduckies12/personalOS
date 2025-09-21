const express = require('express');
const router = express.Router();
const Account = require('../models/accountModel');
const UserPreferences = require('../models/userPreferencesModel');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

// Email service using Nodemailer
const createTransporter = () => {
  if (process.env.NODE_ENV === 'production') {
    // Production configuration with proper SMTP settings
    if (process.env.EMAIL_SERVICE === 'sendgrid') {
      return nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY
        }
      });
    } else if (process.env.EMAIL_SERVICE === 'ses') {
      return nodemailer.createTransport({
        host: 'email-smtp.us-east-1.amazonaws.com', // adjust region
        port: 587,
        secure: false,
        auth: {
          user: process.env.AWS_SES_ACCESS_KEY,
          pass: process.env.AWS_SES_SECRET_KEY
        }
      });
    } else {
      // Fallback to Gmail for production (not recommended for high volume)
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    }
  } else {
    // Development configuration
    if (process.env.EMAIL_SERVICE === 'mailtrap') {
      return nodemailer.createTransport({
        host: 'smtp.mailtrap.io',
        port: 2525,
        auth: {
          user: process.env.MAILTRAP_USER,
          pass: process.env.MAILTRAP_PASS
        }
      });
    } else {
      // Default to Gmail for development
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    }
  }
};

const sendEmail = async (to, subject, html, text = null) => {
  try {
    const transporter = createTransporter();
    
    // Verify connection configuration
    await transporter.verify();
    console.log('Email server connection verified');
    
    const mailOptions = {
      from: {
        name: 'PersonalOS',
        address: process.env.EMAIL_FROM || process.env.EMAIL_USER
      },
      to: to,
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for text version
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId,
      preview: nodemailer.getTestMessageUrl(info) // For development with Ethereal
    };
    
  } catch (error) {
    console.error('Email sending failed:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// Helper function to hash confirmation tokens for security
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Helper function to validate password strength (matching your login route)
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

    // Password strength validation (matching your login route)
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
        code: 'EMAIL_EXISTS'
      });
    }

    // Hash password (matching your login route approach)
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate secure confirmation token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = hashToken(rawToken);

    // Create new account (matching your account model structure)
    const account = new Account({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      status: 'inactive', // Requires email confirmation
      confirmationToken: hashedToken, // Store hashed version
      confirmationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
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
      registrationIP: req.ip || req.connection.remoteAddress
    });

    // Save account
    await account.save();

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
    } catch (preferencesError) {
      console.warn('Failed to create default user preferences:', preferencesError.message);
      // Don't fail registration if preferences creation fails
    }

    // Send confirmation email with the raw token (not hashed)
    let emailSent = false;
    let emailError = null;
    
    try {
      const confirmationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/confirm-email?token=${rawToken}`;
      
      const emailHtml = generateConfirmationEmailHtml(
        `${account.firstName} ${account.lastName}`, 
        confirmationUrl
      );
      
      const emailText = generateConfirmationEmailText(
        `${account.firstName} ${account.lastName}`, 
        confirmationUrl
      );
      
      const emailResult = await sendEmail(
        account.email,
        'Confirm Your PersonalOS Account',
        emailHtml,
        emailText
      );
      
      emailSent = true;
      console.log('Confirmation email sent successfully:', emailResult.messageId);
      
    } catch (error) {
      emailError = error.message;
      console.error('Failed to send confirmation email:', error);
      // Continue with registration even if email fails
    }

    // Return success response (without sensitive data)
    const response = {
      message: emailSent 
        ? 'Account created successfully. Please check your email to confirm your account.'
        : 'Account created successfully. However, we could not send the confirmation email. Please try resending it.',
      code: 'REGISTRATION_SUCCESS',
      account: {
        id: account._id,
        firstName: account.firstName,
        lastName: account.lastName,
        email: account.email,
        status: account.status,
        createdAt: account.createdAt
      },
      emailSent
    };

    if (!emailSent && emailError) {
      response.emailError = 'Failed to send confirmation email. You can request a new one.';
    }

    res.status(201).json(response);

    console.log(`New user registered: ${account.email} at ${new Date().toISOString()}`);

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }

    res.status(500).json({
      error: 'Registration failed. Please try again.',
      code: 'REGISTRATION_ERROR'
    });
  }
});

// POST /api/register/confirm-email - Confirm email address
router.post('/confirm-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Confirmation token is required',
        code: 'MISSING_TOKEN'
      });
    }

    // Hash the incoming token to compare with stored hash
    const hashedToken = hashToken(token);

    // Find account by hashed confirmation token
    const account = await Account.findOne({
      confirmationToken: hashedToken,
      confirmationTokenExpires: { $gt: Date.now() }
    });
    
    if (!account) {
      return res.status(400).json({
        error: 'Invalid or expired confirmation token',
        code: 'INVALID_TOKEN'
      });
    }

    // Confirm account (matching your account model structure)
    account.status = 'active';
    account.confirmationToken = undefined;
    account.confirmationTokenExpires = undefined;
    await account.save();

    // Send welcome email
    try {
      const welcomeHtml = generateWelcomeEmailHtml(`${account.firstName} ${account.lastName}`);
      const welcomeText = generateWelcomeEmailText(`${account.firstName} ${account.lastName}`);
      
      await sendEmail(
        account.email,
        'Welcome to PersonalOS - Your Account is Active!',
        welcomeHtml,
        welcomeText
      );
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail confirmation if welcome email fails
    }

    res.json({
      message: 'Email confirmed successfully. You can now log in.',
      code: 'EMAIL_CONFIRMED',
      account: {
        id: account._id,
        firstName: account.firstName,
        lastName: account.lastName,
        email: account.email,
        status: account.status
      }
    });

    console.log(`Email confirmed for user: ${account.email}`);

  } catch (error) {
    console.error('Email confirmation error:', error);
    res.status(500).json({
      error: 'Email confirmation failed. Please try again.',
      code: 'CONFIRMATION_ERROR'
    });
  }
});

// POST /api/register/resend-confirmation - Resend confirmation email
router.post('/resend-confirmation', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email address is required',
        code: 'MISSING_EMAIL'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const account = await Account.findOne({ email: normalizedEmail });
    
    if (!account) {
      return res.status(404).json({
        error: 'No account found with this email address',
        code: 'ACCOUNT_NOT_FOUND'
      });
    }

    if (account.status === 'active') {
      return res.status(400).json({
        error: 'Account is already confirmed',
        code: 'ALREADY_CONFIRMED'
      });
    }

    // Generate new secure confirmation token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = hashToken(rawToken);
    
    account.confirmationToken = hashedToken;
    account.confirmationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await account.save();

    // Send confirmation email with raw token
    try {
      const confirmationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/confirm-email?token=${rawToken}`;
      
      const emailHtml = generateConfirmationEmailHtml(
        `${account.firstName} ${account.lastName}`, 
        confirmationUrl
      );
      
      const emailText = generateConfirmationEmailText(
        `${account.firstName} ${account.lastName}`, 
        confirmationUrl
      );
      
      await sendEmail(
        account.email,
        'Confirm Your PersonalOS Account',
        emailHtml,
        emailText
      );

      res.json({
        message: 'Confirmation email sent successfully. Please check your email.',
        code: 'CONFIRMATION_SENT'
      });

    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      res.status(500).json({
        error: 'Failed to send confirmation email. Please try again.',
        code: 'EMAIL_SEND_ERROR'
      });
    }

  } catch (error) {
    console.error('Resend confirmation error:', error);
    res.status(500).json({
      error: 'Failed to resend confirmation email. Please try again.',
      code: 'RESEND_ERROR'
    });
  }
});

// GET /api/register/check-email/:email - Check if email is available (production-safe)
router.get('/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({
        error: 'Please enter a valid email address',
        code: 'INVALID_EMAIL'
      });
    }

    // In production, avoid revealing if email exists to prevent enumeration attacks
    if (process.env.NODE_ENV === 'production') {
      // Generic response that doesn't reveal if email exists
      res.json({
        message: 'If this email is available, you can proceed with registration.',
        code: 'EMAIL_CHECK_COMPLETE'
      });
    } else {
      // In development, show actual availability for easier testing
      const normalizedEmail = email.toLowerCase().trim();
      const existingAccount = await Account.findOne({ email: normalizedEmail });
      
      res.json({
        available: !existingAccount,
        message: existingAccount ? 'Email address is already registered' : 'Email address is available',
        code: existingAccount ? 'EMAIL_TAKEN' : 'EMAIL_AVAILABLE'
      });
    }

  } catch (error) {
    console.error('Email check error:', error);
    res.status(500).json({
      error: 'Failed to check email availability',
      code: 'EMAIL_CHECK_ERROR'
    });
  }
});

// Helper function to generate confirmation email HTML
const generateConfirmationEmailHtml = (fullName, confirmationUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirm Your PersonalOS Account</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8f9fa;
            }
            .container {
                background-color: white;
                border-radius: 8px;
                padding: 30px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                padding: 20px 0;
                border-bottom: 2px solid #f0f0f0;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 28px;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 10px;
            }
            .tagline {
                color: #6b7280;
                font-size: 14px;
            }
            .content {
                padding: 20px 0;
            }
            .button {
                display: inline-block;
                padding: 14px 28px;
                background-color: #2563eb;
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin: 25px 0;
                text-align: center;
                transition: background-color 0.2s;
            }
            .button:hover {
                background-color: #1d4ed8;
            }
            .link-text {
                word-break: break-all;
                background-color: #f8f9fa;
                padding: 12px;
                border-radius: 6px;
                font-family: 'Monaco', 'Menlo', monospace;
                font-size: 12px;
                border: 1px solid #e5e7eb;
            }
            .features {
                background-color: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin: 25px 0;
            }
            .features h3 {
                margin-top: 0;
                color: #374151;
            }
            .features ul {
                margin: 15px 0 0 0;
                padding-left: 20px;
            }
            .features li {
                margin-bottom: 8px;
                color: #4b5563;
            }
            .security-notice {
                background-color: #fef3c7;
                border: 1px solid #f59e0b;
                padding: 15px;
                border-radius: 6px;
                margin: 20px 0;
                font-size: 14px;
            }
            .footer {
                text-align: center;
                padding-top: 30px;
                border-top: 1px solid #e5e7eb;
                margin-top: 30px;
                font-size: 13px;
                color: #6b7280;
            }
            .footer a {
                color: #2563eb;
                text-decoration: none;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">PersonalOS</div>
                <div class="tagline">Your Personal Organization System</div>
            </div>
            
            <div class="content">
                <h1 style="color: #1f2937; margin-bottom: 20px;">Welcome to PersonalOS, ${fullName}!</h1>
                
                <p style="font-size: 16px; color: #4b5563;">Thank you for creating your PersonalOS account. You're just one step away from organizing your reading, tasks, and goals like never before.</p>
                
                <p style="font-size: 16px; color: #4b5563;">Please confirm your email address by clicking the button below:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${confirmationUrl}" class="button">Confirm Email Address</a>
                </div>
                
                <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
                <div class="link-text">${confirmationUrl}</div>
                
                <div class="security-notice">
                    <strong>⚠️ Security Notice:</strong> This confirmation link will expire in 24 hours. If you didn't create this account, please ignore this email.
                </div>
                
                <div class="features">
                    <h3>Once your email is confirmed, you'll be able to:</h3>
                    <ul>
                        <li>📚 Track your reading progress with detailed analytics</li>
                        <li>✅ Manage tasks with smart prioritization</li>
                        <li>🎯 Set and achieve personal goals</li>
                        <li>📊 Access comprehensive dashboards and insights</li>
                        <li>⚙️ Customize your personal workspace</li>
                    </ul>
                </div>
                
                <p style="color: #4b5563;">If you have any questions or need assistance, feel free to reach out to our support team.</p>
                
                <p style="margin-top: 30px; color: #374151;">Happy organizing!<br><strong>The PersonalOS Team</strong></p>
            </div>
            
            <div class="footer">
                <p>This email was sent to ${fullName} at the email address associated with your PersonalOS account.</p>
                <p>If you didn't sign up for PersonalOS, please ignore this email.</p>
                <p>&copy; ${new Date().getFullYear()} PersonalOS. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

// Helper function to generate confirmation email text version
const generateConfirmationEmailText = (fullName, confirmationUrl) => {
  return `
Welcome to PersonalOS, ${fullName}!

Thank you for creating your PersonalOS account. You're just one step away from organizing your reading, tasks, and goals like never before.

Please confirm your email address by clicking the link below or copying it into your browser:

${confirmationUrl}

SECURITY NOTICE: This confirmation link will expire in 24 hours. If you didn't create this account, please ignore this email.

Once your email is confirmed, you'll be able to:
• Track your reading progress with detailed analytics
• Manage tasks with smart prioritization  
• Set and achieve personal goals
• Access comprehensive dashboards and insights
• Customize your personal workspace

If you have any questions or need assistance, feel free to reach out to our support team.

Happy organizing!
The PersonalOS Team

---
This email was sent to ${fullName} at the email address associated with your PersonalOS account.
If you didn't sign up for PersonalOS, please ignore this email.

© ${new Date().getFullYear()} PersonalOS. All rights reserved.
  `;
};

// Helper function to generate welcome email HTML
const generateWelcomeEmailHtml = (fullName) => {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to PersonalOS - Account Activated!</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8f9fa;
            }
            .container {
                background-color: white;
                border-radius: 8px;
                padding: 30px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                padding: 20px 0;
                border-bottom: 2px solid #f0f0f0;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 28px;
                font-weight: bold;
                color: #10b981;
                margin-bottom: 10px;
            }
            .success-icon {
                font-size: 48px;
                margin-bottom: 15px;
            }
            .button {
                display: inline-block;
                padding: 14px 28px;
                background-color: #10b981;
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin: 25px 0;
                text-align: center;
            }
            .next-steps {
                background-color: #f0f9ff;
                padding: 20px;
                border-radius: 8px;
                margin: 25px 0;
                border-left: 4px solid #2563eb;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="success-icon">🎉</div>
                <div class="logo">PersonalOS</div>
                <h2 style="color: #10b981; margin: 10px 0;">Account Activated!</h2>
            </div>
            
            <div class="content">
                <h1 style="color: #1f2937; margin-bottom: 20px;">Welcome aboard, ${fullName}!</h1>
                
                <p style="font-size: 16px; color: #4b5563;">Your PersonalOS account has been successfully activated! You're now ready to take control of your personal organization.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${dashboardUrl}" class="button">Go to Your Dashboard</a>
                </div>
                
                <div class="next-steps">
                    <h3 style="margin-top: 0; color: #1e40af;">Your Next Steps:</h3>
                    <ol style="color: #4b5563; padding-left: 20px;">
                        <li>Set up your reading goals and preferences</li>
                        <li>Add your first book or article to track</li>
                        <li>Create tasks and organize your to-dos</li>
                        <li>Explore the analytics dashboard</li>
                        <li>Customize your workspace settings</li>
                    </ol>
                </div>
                
                <p style="color: #4b5563;">We're excited to help you stay organized and achieve your goals. If you need any help getting started, don't hesitate to reach out!</p>
                
                <p style="margin-top: 30px; color: #374151;">Happy organizing!<br><strong>The PersonalOS Team</strong></p>
            </div>
        </div>
    </body>
    </html>
  `;
};

// Helper function to generate welcome email text version
const generateWelcomeEmailText = (fullName) => {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;
  
  return `
Welcome aboard, ${fullName}!

Your PersonalOS account has been successfully activated! You're now ready to take control of your personal organization.

Go to your dashboard: ${dashboardUrl}

Your Next Steps:
1. Set up your reading goals and preferences
2. Add your first book or article to track  
3. Create tasks and organize your to-dos
4. Explore the analytics dashboard
5. Customize your workspace settings

We're excited to help you stay organized and achieve your goals. If you need any help getting started, don't hesitate to reach out!

Happy organizing!
The PersonalOS Team
  `;
};

module.exports = router;