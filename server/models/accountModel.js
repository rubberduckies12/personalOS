const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const accountSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters long'],
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters long'],
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true, // This already creates an index, so no need for a separate index
    lowercase: true,
    trim: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please enter a valid email address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'inactive',
    required: true
  },
  confirmationToken: {
    type: String,
    default: null
  },
  confirmationTokenExpires: {
    type: Date,
    default: null
  },
  refreshToken: {
    type: String,
    default: null
  },
  lastLoginAt: {
    type: Date,
    default: null
  },
  loginCount: {
    type: Number,
    default: 0
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
    type: Date,
    default: null
  },
  passwordChangedAt: {
    type: Date
  },
  avatar: {
    type: String,
    default: null
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: false }
    },
    privacy: {
      profileVisible: { type: Boolean, default: false },
      dataSharing: { type: Boolean, default: false }
    }
  },
  registrationIP: {
    type: String
  }
}, {
  timestamps: true,
  collection: 'accounts'
});

// Removed duplicate indexes
// The `unique: true` on `email` already creates an index, so no need for `accountSchema.index({ email: 1 });`
// Removed `accountSchema.index({ confirmationToken: 1 });`
// Removed `accountSchema.index({ passwordResetToken: 1 });`
// Removed `accountSchema.index({ refreshToken: 1 });`
// Removed `accountSchema.index({ status: 1 });`

// Virtual for account lockout status
accountSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Instance method to get full name
accountSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

// Instance method to get public profile
accountSchema.methods.toPublicProfile = function() {
  const account = this.toObject();
  delete account.password;
  delete account.confirmationToken;
  delete account.passwordResetToken;
  delete account.refreshToken;
  delete account.loginAttempts;
  delete account.lockUntil;
  return account;
};

// Static methods
accountSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

accountSchema.statics.findByConfirmationToken = function(token) {
  return this.findOne({
    confirmationToken: token,
    confirmationTokenExpires: { $gt: Date.now() }
  });
};

const Account = mongoose.model('Account', accountSchema);

module.exports = Account;