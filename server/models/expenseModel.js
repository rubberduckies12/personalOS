const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: [true, 'User ID is required'],
    index: true // Keep this index
  },
  name: {
    type: String,
    required: [true, 'Expense name is required'],
    trim: true,
    maxlength: [100, 'Expense name cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Expense category is required'],
    enum: {
      values: [
        'Food & Dining',
        'Transportation',
        'Shopping',
        'Entertainment',
        'Bills & Utilities',
        'Auto & Transport',
        'Travel',
        'Fees & Charges',
        'Business Services',
        'Personal Care',
        'Education',
        'Healthcare',
        'Kids',
        'Pets',
        'Gifts & Donations',
        'Investments',
        'Taxes',
        'Other'
      ],
      message: 'Please select a valid expense category'
    }
  },
  amount: {
    type: mongoose.Decimal128,
    required: [true, 'Amount is required'],
    validate: {
      validator: function(value) {
        const decimal = parseFloat(value.toString());
        return decimal > 0;
      },
      message: 'Amount must be greater than 0'
    }
  },
  paidAmount: {
    type: mongoose.Decimal128,
    default: 0,
    validate: {
      validator: function(value) {
        const paid = parseFloat(value.toString());
        const total = parseFloat(this.amount.toString());
        return paid >= 0 && paid <= total;
      },
      message: 'Paid amount cannot be negative or exceed total amount'
    }
  },
  currency: {
    type: String,
    enum: ['USD', 'GBP', 'EUR'],
    default: 'GBP',
    required: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [255, 'Description cannot exceed 255 characters'],
    default: ''
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    default: Date.now
  },
  isPaid: {
    type: Boolean,
    default: false,
    required: true
  },
  paidDate: {
    type: Date,
    default: null
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  frequency: {
    type: String,
    enum: ['weekly', 'bi-weekly', 'monthly', 'quarterly', 'yearly'],
    required: function() {
      return this.isRecurring;
    }
  },
  nextDueDate: {
    type: Date,
    default: null
  },
  isOverdue: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  collection: 'expenses'
});

// Removed duplicate indexes
// The following indexes were removed because they were redundant:
// - `expenseSchema.index({ userId: 1, isPaid: 1 });`
// - `expenseSchema.index({ userId: 1, nextDueDate: 1 });`
// - `expenseSchema.index({ userId: 1, isOverdue: 1 });`

// Optimized compound indexes for efficient queries
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, category: 1 });

// Virtual for remaining balance
expenseSchema.virtual('remainingBalance').get(function() {
  const total = parseFloat(this.amount.toString());
  const paid = parseFloat(this.paidAmount.toString());
  return Math.max(0, total - paid);
});

// Virtual for payment percentage
expenseSchema.virtual('paymentPercentage').get(function() {
  const total = parseFloat(this.amount.toString());
  const paid = parseFloat(this.paidAmount.toString());
  return total > 0 ? Math.round((paid / total) * 100) : 0;
});

// Virtual for payment status
expenseSchema.virtual('paymentStatus').get(function() {
  const percentage = this.paymentPercentage;
  if (percentage === 100) return 'paid';
  if (percentage > 0) return 'partial';
  if (this.isOverdue) return 'overdue';
  return 'unpaid';
});

// Instance method to format amount with currency
expenseSchema.methods.getFormattedAmount = function() {
  const amount = parseFloat(this.amount.toString());
  const symbols = { USD: '$', GBP: '£', EUR: '€' };
  return `${symbols[this.currency] || '£'}${amount.toFixed(2)}`;
};

// Instance method to format paid amount
expenseSchema.methods.getFormattedPaidAmount = function() {
  const amount = parseFloat(this.paidAmount.toString());
  const symbols = { USD: '$', GBP: '£', EUR: '€' };
  return `${symbols[this.currency] || '£'}${amount.toFixed(2)}`;
};

// Instance method to format remaining balance
expenseSchema.methods.getFormattedRemainingBalance = function() {
  const symbols = { USD: '$', GBP: '£', EUR: '€' };
  return `${symbols[this.currency] || '£'}${this.remainingBalance.toFixed(2)}`;
};

// Enhanced method to handle partial payments
expenseSchema.methods.addPayment = function(paymentAmount) {
  const currentPaid = parseFloat(this.paidAmount.toString());
  const totalAmount = parseFloat(this.amount.toString());
  const newPaidAmount = currentPaid + paymentAmount;
  
  if (newPaidAmount > totalAmount) {
    throw new Error('Payment amount exceeds remaining balance');
  }
  
  this.paidAmount = newPaidAmount;
  
  // Update paid status
  if (newPaidAmount >= totalAmount) {
    this.isPaid = true;
    this.paidDate = new Date();
    this.isOverdue = false;
  }
  
  return this.save();
};

// Instance method to mark as fully paid
expenseSchema.methods.markAsPaid = function() {
  this.isPaid = true;
  this.paidAmount = this.amount;
  this.paidDate = new Date();
  this.isOverdue = false;
  return this.save();
};

// Instance method to mark as unpaid
expenseSchema.methods.markAsUnpaid = function() {
  this.isPaid = false;
  this.paidAmount = 0;
  this.paidDate = null;
  return this.save();
};

// Instance method to mark as overdue
expenseSchema.methods.markAsOverdue = function() {
  this.isOverdue = true;
  return this.save();
};

// Instance method to calculate next due date for recurring expenses
expenseSchema.methods.calculateNextDueDate = function() {
  if (!this.isRecurring) return null;
  
  const currentDate = this.nextDueDate || this.date || new Date();
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
  
  this.nextDueDate = nextDate;
  return nextDate;
};

// Static method to get user's total expenses (normalized return format)
expenseSchema.statics.getTotalByUser = async function(userId, startDate, endDate, currency = null) {
  const match = { userId: new mongoose.Types.ObjectId(userId) };
  
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = new Date(startDate);
    if (endDate) match.date.$lte = new Date(endDate);
  }
  
  if (currency) {
    match.currency = currency;
  }

  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$currency',
        totalAmount: { $sum: { $toDouble: '$amount' } },
        totalPaid: { $sum: { $toDouble: '$paidAmount' } },
        count: { $sum: 1 }
      }
    }
  ]);

  // Normalize return format for consistent frontend handling
  return result.reduce((acc, r) => {
    acc[r._id] = { 
      totalAmount: r.totalAmount, 
      totalPaid: r.totalPaid,
      totalRemaining: r.totalAmount - r.totalPaid,
      count: r.count 
    };
    return acc;
  }, {});
};

// Include virtuals when converting to JSON
expenseSchema.set('toJSON', { virtuals: true });
expenseSchema.set('toObject', { virtuals: true });

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = Expense;