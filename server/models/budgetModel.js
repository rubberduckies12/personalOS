const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: [true, 'User ID is required'],
    index: true // Keep this index
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
    type: mongoose.Decimal128,
    required: [true, 'Budget amount is required'],
    validate: {
      validator: function(value) {
        const decimal = parseFloat(value.toString());
        return decimal > 0;
      },
      message: 'Amount must be greater than 0'
    }
  },
  currency: {
    type: String,
    enum: ['USD', 'GBP', 'EUR'],
    default: 'GBP',
    required: true
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
  date: {
    type: Date,
    required: function() {
      return !this.isRecurring;
    },
    default: Date.now
  },
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
    type: mongoose.Decimal128,
    default: 0,
    validate: {
      validator: function(value) {
        const spent = parseFloat(value.toString());
        return spent >= 0;
      },
      message: 'Current spent cannot be negative'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isClosed: {
    type: Boolean,
    default: false,
    required: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    required: true,
    index: true
  },
  closedDate: {
    type: Date,
    default: null
  },
  deletedDate: {
    type: Date,
    default: null
  },
  nextResetDate: {
    type: Date,
    default: null
  },
  alertThreshold: {
    type: Number,
    min: [0, 'Alert threshold cannot be negative'],
    max: [100, 'Alert threshold cannot exceed 100%'],
    default: 80,
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

// Removed duplicate indexes
// The following indexes were removed because they were redundant:
// - `budgetSchema.index({ userId: 1, startDate: -1 });`
// - `budgetSchema.index({ userId: 1, isActive: 1 });`
// - `budgetSchema.index({ userId: 1, isClosed: 1 });`
// - `budgetSchema.index({ userId: 1, isDeleted: 1 });`
// - `budgetSchema.index({ userId: 1, nextResetDate: 1 });`
// - `budgetSchema.index({ userId: 1, nextResetDate: 1, isActive: 1, isDeleted: 1 });`
// - `budgetSchema.index({ userId: 1, isActive: 1, isClosed: 1, isDeleted: 1 });`

// Optimized compound indexes for efficient queries
budgetSchema.index({ userId: 1, date: -1 });
budgetSchema.index({ userId: 1, category: 1 });

// Virtual for remaining budget
budgetSchema.virtual('remainingAmount').get(function() {
  const total = parseFloat(this.amount.toString());
  const spent = parseFloat(this.currentSpent.toString());
  return Math.max(0, total - spent);
});

// Virtual for spent percentage
budgetSchema.virtual('spentPercentage').get(function() {
  const total = parseFloat(this.amount.toString());
  const spent = parseFloat(this.currentSpent.toString());
  return total > 0 ? Math.round((spent / total) * 100) : 0;
});

// Virtual for budget status
budgetSchema.virtual('status').get(function() {
  if (this.isDeleted) return 'deleted';
  if (this.isClosed) return 'closed';
  if (!this.isActive) return 'inactive';
  const percentage = this.spentPercentage;
  if (percentage >= 100) return 'exceeded';
  if (percentage >= this.alertThreshold) return 'warning';
  return 'on-track';
});

// Instance method to check if budget is exceeded
budgetSchema.methods.isExceeded = function() {
  const total = parseFloat(this.amount.toString());
  const spent = parseFloat(this.currentSpent.toString());
  return spent >= total;
};

// Instance method to check if alert threshold is reached
budgetSchema.methods.shouldAlert = function() {
  return this.spentPercentage >= this.alertThreshold && !this.isClosed && this.isActive && !this.isDeleted;
};

// Instance method to add expense to current spent
budgetSchema.methods.addExpense = function(expenseAmount) {
  const currentSpent = parseFloat(this.currentSpent.toString());
  this.currentSpent = currentSpent + expenseAmount;
  return this.save();
};

// Instance method to apply expense automatically based on category/currency match
budgetSchema.methods.applyExpense = function(expenseDoc) {
  // Only apply if categories and currencies match, and budget is active and not deleted
  if (this.category === expenseDoc.category && 
      this.currency === expenseDoc.currency && 
      this.isActive && 
      !this.isClosed &&
      !this.isDeleted) {
    
    const expenseAmount = parseFloat(expenseDoc.amount.toString());
    return this.addExpense(expenseAmount);
  }
  return Promise.resolve(this);
};

// Instance method to format amount with currency
budgetSchema.methods.getFormattedAmount = function() {
  const amount = parseFloat(this.amount.toString());
  const symbols = { USD: '$', GBP: '£', EUR: '€' };
  return `${symbols[this.currency] || '£'}${amount.toFixed(2)}`;
};

// Instance method to format current spent with currency
budgetSchema.methods.getFormattedCurrentSpent = function() {
  const spent = parseFloat(this.currentSpent.toString());
  const symbols = { USD: '$', GBP: '£', EUR: '€' };
  return `${symbols[this.currency] || '£'}${spent.toFixed(2)}`;
};

// Instance method to format remaining amount with currency
budgetSchema.methods.getFormattedRemainingAmount = function() {
  const symbols = { USD: '$', GBP: '£', EUR: '€' };
  return `${symbols[this.currency] || '£'}${this.remainingAmount.toFixed(2)}`;
};

// Instance method to mark as closed
budgetSchema.methods.markAsClosed = function() {
  this.isClosed = true;
  this.closedDate = new Date();
  return this.save();
};

// Instance method to reopen budget
budgetSchema.methods.reopenBudget = function() {
  this.isClosed = false;
  this.closedDate = null;
  return this.save();
};

// Instance method to soft delete budget (archive)
budgetSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedDate = new Date();
  this.isActive = false;
  return this.save();
};

// Instance method to restore deleted budget
budgetSchema.methods.restore = function() {
  this.isDeleted = false;
  this.deletedDate = null;
  this.isActive = true;
  return this.save();
};

// Instance method to permanently delete budget
budgetSchema.methods.permanentDelete = function() {
  return this.deleteOne();
};

// Instance method to reset budget (for recurring budgets)
budgetSchema.methods.resetBudget = function() {
  this.currentSpent = 0;
  this.isClosed = false;
  this.closedDate = null;
  
  // Calculate next reset date if recurring
  if (this.isRecurring) {
    this.calculateNextResetDate();
  }
  
  return this.save();
};

// Instance method to calculate next reset date for recurring budgets
budgetSchema.methods.calculateNextResetDate = function() {
  if (!this.isRecurring) return null;
  
  const currentDate = this.nextResetDate || this.startDate || new Date();
  const nextDate = new Date(currentDate);
  
  switch(this.frequency) {
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'bi-weekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      return null;
  }
  
  this.nextResetDate = nextDate;
  return nextDate;
};

// Static method to get active budgets for user (excludes deleted)
budgetSchema.statics.getActiveBudgets = function(userId) {
  return this.find({ 
    userId: new mongoose.Types.ObjectId(userId), 
    isActive: true,
    isClosed: false,
    isDeleted: false
  }).sort({ date: -1, startDate: -1 });
};

// Static method to get closed budgets (excludes deleted)
budgetSchema.statics.getClosedBudgets = function(userId) {
  return this.find({ 
    userId: new mongoose.Types.ObjectId(userId), 
    isClosed: true,
    isDeleted: false
  }).sort({ closedDate: -1, date: -1, startDate: -1 });
};

// Static method to get deleted budgets (archived)
budgetSchema.statics.getDeletedBudgets = function(userId) {
  return this.find({ 
    userId: new mongoose.Types.ObjectId(userId), 
    isDeleted: true
  }).sort({ deletedDate: -1, date: -1, startDate: -1 });
};

// Static method to get budgets by category (excludes deleted)
budgetSchema.statics.getBudgetsByCategory = function(userId, category) {
  return this.find({ 
    userId: new mongoose.Types.ObjectId(userId), 
    category: category,
    isActive: true,
    isClosed: false,
    isDeleted: false
  }).sort({ date: -1, startDate: -1 });
};

// Static method to apply expense to matching budgets (excludes deleted)
budgetSchema.statics.applyExpenseToMatchingBudgets = async function(expenseDoc) {
  const matchingBudgets = await this.find({
    userId: expenseDoc.userId,
    category: expenseDoc.category,
    currency: expenseDoc.currency,
    isActive: true,
    isClosed: false,
    isDeleted: false
  });

  const results = [];
  for (const budget of matchingBudgets) {
    const updated = await budget.applyExpense(expenseDoc);
    results.push(updated);
  }

  return results;
};

// Static method to get totals across all budgets (excludes deleted)
budgetSchema.statics.getTotals = async function(userId, currency = null) {
  const match = { 
    userId: new mongoose.Types.ObjectId(userId), 
    isActive: true,
    isClosed: false,
    isDeleted: false
  };
  
  if (currency) {
    match.currency = currency;
  }

  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$currency',
        totalBudgeted: { $sum: { $toDouble: '$amount' } },
        totalSpent: { $sum: { $toDouble: '$currentSpent' } },
        count: { $sum: 1 },
        exceededCount: {
          $sum: {
            $cond: [
              { $gte: [{ $toDouble: '$currentSpent' }, { $toDouble: '$amount' }] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  return result.reduce((acc, r) => {
    acc[r._id] = {
      totalBudgeted: r.totalBudgeted,
      totalSpent: r.totalSpent,
      totalRemaining: Math.max(0, r.totalBudgeted - r.totalSpent),
      spentPercentage: r.totalBudgeted > 0 ? Math.round((r.totalSpent / r.totalBudgeted) * 100) : 0,
      count: r.count,
      exceededCount: r.exceededCount
    };
    return acc;
  }, {});
};

// Static method to get budgets due for reset (for cron jobs, excludes deleted)
budgetSchema.statics.getDueForReset = function() {
  const now = new Date();
  
  return this.find({
    isRecurring: true,
    isActive: true,
    isClosed: false,
    isDeleted: false,
    nextResetDate: { $lte: now }
  }).sort({ nextResetDate: 1 });
};

// Static method to auto-reset budgets due for reset (for cron jobs)
budgetSchema.statics.resetDueBudgets = async function() {
  const dueBudgets = await this.getDueForReset();
  
  const results = [];
  for (const budget of dueBudgets) {
    const reset = await budget.resetBudget();
    results.push(reset);
  }
  
  return results;
};

// Static method to deactivate expired budgets (for cron jobs, excludes deleted)
budgetSchema.statics.deactivateExpired = async function() {
  const now = new Date();
  
  const result = await this.updateMany(
    { 
      isRecurring: true, 
      endDate: { $lt: now }, 
      isActive: true,
      isDeleted: false
    },
    { 
      $set: { isActive: false } 
    }
  );
  
  return result;
};

// Static method to permanently delete old soft-deleted budgets (for cleanup cron)
budgetSchema.statics.cleanupOldDeleted = async function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await this.deleteMany({
    isDeleted: true,
    deletedDate: { $lt: cutoffDate }
  });
  
  return result;
};

// Auto-convert Decimal128 to numbers in JSON for frontend
budgetSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    if (ret.amount) ret.amount = parseFloat(ret.amount.toString());
    if (ret.currentSpent) ret.currentSpent = parseFloat(ret.currentSpent.toString());
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

budgetSchema.set('toObject', { virtuals: true });

const Budget = mongoose.model('Budget', budgetSchema);

module.exports = Budget;