const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: [true, 'User ID is required'],
    index: true
  },
  budgetName: {
    type: String,
    required: [true, 'Budget name is required'],
    trim: true,
    maxlength: [100, 'Budget name cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Budget category is required'],
    enum: {
      values: [
        'Food & Dining',
        'Transportation',
        'Shopping',
        'Entertainment',
        'Bills & Utilities',
        'Healthcare',
        'Personal Care',
        'Education',
        'Travel',
        'Savings',
        'Investments',
        'Emergency Fund',
        'Debt Payment',
        'Housing',
        'Insurance',
        'Other'
      ],
      message: 'Please select a valid budget category'
    }
  },
  amount: {
    type: Number,
    required: [true, 'Budget amount is required'],
    min: [0.01, 'Amount must be greater than 0'],
    validate: {
      validator: function(value) {
        return Number.isFinite(value) && value > 0;
      },
      message: 'Amount must be a valid positive number'
    }
  },
  isRecurring: {
    type: Boolean,
    default: false,
    required: true
  },
  frequency: {
    type: String,
    enum: ['weekly', 'bi-weekly', 'monthly', 'quarterly', 'yearly'],
    required: function() {
      return this.isRecurring;
    }
  },
  // For non-recurring budgets - single date
  date: {
    type: Date,
    required: function() {
      return !this.isRecurring;
    },
    default: Date.now
  },
  // For recurring budgets - start and end dates
  startDate: {
    type: Date,
    required: function() {
      return this.isRecurring;
    }
  },
  endDate: {
    type: Date,
    validate: {
      validator: function(value) {
        // Only validate if this is a recurring budget and endDate is provided
        return !this.isRecurring || !value || value > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  description: {
    type: String,
    trim: true,
    maxlength: [255, 'Description cannot exceed 255 characters'],
    default: ''
  },
  currentSpent: {
    type: Number,
    default: 0,
    min: [0, 'Current spent cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  alertThreshold: {
    type: Number,
    min: [0, 'Alert threshold cannot be negative'],
    max: [100, 'Alert threshold cannot exceed 100%'],
    default: 80, // Alert when 80% of budget is spent
    validate: {
      validator: function(value) {
        return value >= 0 && value <= 100;
      },
      message: 'Alert threshold must be between 0 and 100'
    }
  }
}, {
  timestamps: true,
  collection: 'budgets'
});

// Compound indexes for efficient queries
budgetSchema.index({ userId: 1, date: -1 });
budgetSchema.index({ userId: 1, startDate: -1 });
budgetSchema.index({ userId: 1, category: 1 });
budgetSchema.index({ userId: 1, isActive: 1 });

// Virtual for remaining budget
budgetSchema.virtual('remainingAmount').get(function() {
  return Math.max(0, this.amount - this.currentSpent);
});

// Virtual for spent percentage
budgetSchema.virtual('spentPercentage').get(function() {
  return this.amount > 0 ? Math.round((this.currentSpent / this.amount) * 100) : 0;
});

// Virtual for budget status
budgetSchema.virtual('status').get(function() {
  const percentage = this.spentPercentage;
  if (percentage >= 100) return 'exceeded';
  if (percentage >= this.alertThreshold) return 'warning';
  return 'on-track';
});

// Instance method to check if budget is exceeded
budgetSchema.methods.isExceeded = function() {
  return this.currentSpent >= this.amount;
};

// Instance method to check if alert threshold is reached
budgetSchema.methods.shouldAlert = function() {
  return this.spentPercentage >= this.alertThreshold;
};

// Instance method to add expense to current spent
budgetSchema.methods.addExpense = function(expenseAmount) {
  this.currentSpent += expenseAmount;
  return this.save();
};

// Instance method to format amount
budgetSchema.methods.getFormattedAmount = function() {
  return `$${this.amount.toFixed(2)}`;
};

// Instance method to get next reset date for recurring budgets
budgetSchema.methods.getNextResetDate = function() {
  if (!this.isRecurring) return null;
  
  const currentDate = new Date();
  const startDate = new Date(this.startDate);
  
  switch(this.frequency) {
    case 'weekly':
      return new Date(currentDate.getTime() + (7 * 24 * 60 * 60 * 1000));
    case 'bi-weekly':
      return new Date(currentDate.getTime() + (14 * 24 * 60 * 60 * 1000));
    case 'monthly':
      const nextMonth = new Date(currentDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return nextMonth;
    case 'quarterly':
      const nextQuarter = new Date(currentDate);
      nextQuarter.setMonth(nextQuarter.getMonth() + 3);
      return nextQuarter;
    case 'yearly':
      const nextYear = new Date(currentDate);
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      return nextYear;
    default:
      return null;
  }
};

// Static method to get active budgets for user
budgetSchema.statics.getActiveBudgets = function(userId) {
  return this.find({ 
    userId: new mongoose.Types.ObjectId(userId), 
    isActive: true 
  }).sort({ date: -1, startDate: -1 });
};

// Static method to get budgets by category
budgetSchema.statics.getBudgetsByCategory = function(userId, category) {
  return this.find({ 
    userId: new mongoose.Types.ObjectId(userId), 
    category: category,
    isActive: true 
  }).sort({ date: -1, startDate: -1 });
};

// Include virtuals when converting to JSON
budgetSchema.set('toJSON', { virtuals: true });
budgetSchema.set('toObject', { virtuals: true });

const Budget = mongoose.model('Budget', budgetSchema);

module.exports = Budget;