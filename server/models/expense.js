const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: [true, 'User ID is required'],
    index: true
  },
  expense: {
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
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0'],
    validate: {
      validator: function(value) {
        return Number.isFinite(value) && value > 0;
      },
      message: 'Amount must be a valid positive number'
    }
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
  }
}, {
  timestamps: true,
  collection: 'expenses'
});

// Compound index for user and date queries
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, category: 1 });
expenseSchema.index({ userId: 1, isPaid: 1 });

// Instance method to format amount
expenseSchema.methods.getFormattedAmount = function() {
  return `$${this.amount.toFixed(2)}`;
};

// Instance method to mark as paid
expenseSchema.methods.markAsPaid = function() {
  this.isPaid = true;
  this.paidDate = new Date();
  return this.save();
};

// Instance method to mark as unpaid
expenseSchema.methods.markAsUnpaid = function() {
  this.isPaid = false;
  this.paidDate = null;
  return this.save();
};

// Static method to get user's total expenses
expenseSchema.statics.getTotalByUser = async function(userId, startDate, endDate) {
  const match = { userId: new mongoose.Types.ObjectId(userId) };
  
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = new Date(startDate);
    if (endDate) match.date.$lte = new Date(endDate);
  }

  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  return result[0] || { totalAmount: 0, count: 0 };
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

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = Expense;