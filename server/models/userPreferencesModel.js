const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  reading: {
    yearlyGoal: {
      type: Number,
      default: 52,
      min: 1,
      max: 1000
    },
    defaultPageTime: {
      type: Number, // minutes per page
      default: 3,
      min: 0.5,
      max: 30
    },
    preferredGenres: [{
      type: String,
      enum: [
        'fiction', 'non-fiction', 'biography', 'business', 'self-help',
        'science', 'history', 'philosophy', 'technology', 'health',
        'education', 'thriller', 'romance', 'fantasy', 'mystery',
        'psychology', 'economics', 'politics', 'religion', 'art', 'other'
      ]
    }],
    reminderSettings: {
      enabled: { type: Boolean, default: true },
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        default: 'weekly'
      },
      time: {
        type: String,
        default: '18:00'
      }
    }
  },
  tasks: {
    defaultPriority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    defaultDuration: {
      type: Number, // minutes
      default: 60,
      min: 5,
      max: 480
    },
    autoArchiveCompleted: {
      type: Boolean,
      default: false
    },
    reminderSettings: {
      enabled: { type: Boolean, default: true },
      beforeDeadline: {
        type: Number, // hours
        default: 24
      }
    }
  },
  goals: {
    defaultTimeframe: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
      default: 'monthly'
    },
    reviewFrequency: {
      type: String,
      enum: ['weekly', 'bi-weekly', 'monthly'],
      default: 'weekly'
    }
  },
  dashboard: {
    defaultView: {
      type: String,
      enum: ['overview', 'reading', 'tasks', 'goals'],
      default: 'overview'
    },
    showCompletedItems: {
      type: Boolean,
      default: true
    },
    itemsPerPage: {
      type: Number,
      default: 20,
      min: 5,
      max: 100
    }
  },
  notifications: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: false }
  },
  privacy: {
    publicProfile: { type: Boolean, default: false },
    shareReadingProgress: { type: Boolean, default: false },
    shareGoals: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Static method to get user preferences with defaults
userPreferencesSchema.statics.getUserPreferences = async function(userId) {
  let preferences = await this.findOne({ userId });
  
  if (!preferences) {
    // Create default preferences if none exist
    preferences = new this({ userId });
    await preferences.save();
  }
  
  return preferences;
};

// Instance method to update specific preference category
userPreferencesSchema.methods.updateCategory = function(category, updates) {
  if (this[category]) {
    Object.assign(this[category], updates);
  }
  return this.save();
};

module.exports = mongoose.model('UserPreferences', userPreferencesSchema);