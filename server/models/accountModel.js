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
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email address'
    ]
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  isConfirmed: {
    type: Boolean,
    default: false,
    required: true
  },
  confirmationToken: {
    type: String,
    default: null
  },
  confirmationTokenExpires: {
    type: Date,
    default: null
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
  collection: 'accounts'
});

// Index for faster email lookups
accountSchema.index({ email: 1 });
accountSchema.index({ confirmationToken: 1 });

// Pre-save middleware to hash password
accountSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('passwordHash')) return next();

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
accountSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.passwordHash);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Instance method to get full name
accountSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

// Instance method to get public profile (without password)
accountSchema.methods.toPublicProfile = function() {
  const account = this.toObject();
  delete account.passwordHash;
  delete account.confirmationToken;
  return account;
};

// Instance method to generate confirmation token
accountSchema.methods.generateConfirmationToken = function() {
  const crypto = require('crypto');
  this.confirmationToken = crypto.randomBytes(32).toString('hex');
  this.confirmationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return this.confirmationToken;
};

// Instance method to confirm account
accountSchema.methods.confirmAccount = function() {
  this.isConfirmed = true;
  this.confirmationToken = null;
  this.confirmationTokenExpires = null;
};

// Static method to find by email
accountSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find by confirmation token
accountSchema.statics.findByConfirmationToken = function(token) {
  return this.findOne({
    confirmationToken: token,
    confirmationTokenExpires: { $gt: Date.now() }
  });
};

const Account = mongoose.model('Account', accountSchema);

module.exports = Account;