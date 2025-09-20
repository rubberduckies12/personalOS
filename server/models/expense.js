const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: [true, 'User ID is required'],
    index: true
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

// Compound indexes for efficient queries
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, category: 1 });
expenseSchema.index({ userId: 1, isPaid: 1 });
expenseSchema.index({ userId: 1, nextDueDate: 1 });
expenseSchema.index({ userId: 1, isOverdue: 1 });

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

// Instance method to roll forward recurring expense
expenseSchema.methods.rollForward = async function() {
  if (!this.isRecurring) return null;
  
  // Calculate next due date
  this.calculateNextDueDate();
  
  // Reset payment status for new period
  this.isPaid = false;
  this.paidAmount = 0;
  this.paidDate = null;
  this.isOverdue = false;
  
  return this.save();
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

// Static method to get expenses by category for a user
expenseSchema.statics.getByCategory = function(userId, category) {
  return this.find({ 
    userId: new mongoose.Types.ObjectId(userId), 
    category: category 
  }).sort({ date: -1 });
};

// Static method to get paid/unpaid expenses
expenseSchema.statics.getPaidExpenses = function(userId, isPaid = true) {
  return this.find({ 
    userId: new mongoose.Types.ObjectId(userId), 
    isPaid: isPaid 
  }).sort({ paidDate: -1, date: -1 });
};

// Static method to get partially paid expenses
expenseSchema.statics.getPartiallyPaid = function(userId) {
  return this.find({
    userId: new mongoose.Types.ObjectId(userId),
    isPaid: false,
    paidAmount: { $gt: 0 }
  }).sort({ date: -1 });
};

// Static method to get expenses by date range
expenseSchema.statics.getByDateRange = function(userId, startDate, endDate) {
  return this.find({
    userId: new mongoose.Types.ObjectId(userId),
    date: { $gte: new Date(startDate), $lte: new Date(endDate) }
  }).sort({ date: -1 });
};

// Static method to get recurring expenses due soon
expenseSchema.statics.getDueSoon = function(userId, daysAhead = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return this.find({
    userId: new mongoose.Types.ObjectId(userId),
    isRecurring: true,
    nextDueDate: { $lte: futureDate }
  }).sort({ nextDueDate: 1 });
};

// Static method to get unpaid bills due soon
expenseSchema.statics.getUnpaidDueSoon = function(userId, daysAhead = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return this.find({
    userId: new mongoose.Types.ObjectId(userId),
    isPaid: false,
    $or: [
      { nextDueDate: { $lte: futureDate } },
      { date: { $lte: futureDate } }
    ]
  }).sort({ nextDueDate: 1, date: 1 });
};

// Static method to get overdue unpaid expenses
expenseSchema.statics.getOverdue = function(userId) {
  return this.find({
    userId: new mongoose.Types.ObjectId(userId),
    isOverdue: true,
    isPaid: false
  }).sort({ nextDueDate: 1, date: 1 });
};

// Static method to auto-mark overdue expenses (for cron jobs)
expenseSchema.statics.markOverdueExpenses = async function() {
  const now = new Date();
  
  const result = await this.updateMany(
    {
      isPaid: false,
      isOverdue: false,
      $or: [
        { nextDueDate: { $lt: now } },
        { 
          date: { $lt: now },
          isRecurring: false
        }
      ]
    },
    { 
      $set: { isOverdue: true }
    }
  );
  
  return result;
};

// Static method to roll forward all due recurring expenses (for cron jobs)
expenseSchema.statics.rollForwardDueRecurring = async function() {
  const now = new Date();
  
  const dueExpenses = await this.find({
    isRecurring: true,
    nextDueDate: { $lte: now }
  });
  
  const results = [];
  for (const expense of dueExpenses) {
    const rolled = await expense.rollForward();
    results.push(rolled);
  }
  
  return results;
};

// Include virtuals when converting to JSON
expenseSchema.set('toJSON', { virtuals: true });
expenseSchema.set('toObject', { virtuals: true });

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = Expense;