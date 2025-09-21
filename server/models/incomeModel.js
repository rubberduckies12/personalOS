const mongoose = require('mongoose');

const incomeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: [true, 'User ID is required'],
    index: true
  },
  source: {
    type: String,
    required: [true, 'Income source is required'],
    trim: true,
    maxlength: [100, 'Source cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Income category is required'],
    enum: {
      values: [
        'Salary',
        'Freelance',
        'Business',
        'Investment',
        'Rental',
        'Dividend',
        'Interest',
        'Bonus',
        'Commission',
        'Gift',
        'Other'
      ],
      message: 'Please select a valid income category'
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
  }
}, {
  timestamps: true,
  collection: 'incomes'
});

// Compound index for user and date queries
incomeSchema.index({ userId: 1, date: -1 });
incomeSchema.index({ userId: 1, category: 1 });
incomeSchema.index({ userId: 1, nextDueDate: 1 });

// Instance method to format amount with currency
incomeSchema.methods.getFormattedAmount = function() {
  const amount = parseFloat(this.amount.toString());
  const symbols = { USD: '$', GBP: '£', EUR: '€' };
  return `${symbols[this.currency] || '£'}${amount.toFixed(2)}`;
};

// Instance method to calculate next due date for recurring income
incomeSchema.methods.calculateNextDueDate = function() {
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

// Static method to get user's total income
incomeSchema.statics.getTotalByUser = async function(userId, startDate, endDate, currency = null) {
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
        count: { $sum: 1 }
      }
    }
  ]);

  return result.length > 0 ? result : [{ _id: 'GBP', totalAmount: 0, count: 0 }];
};

// Static method to get income by category for a user
incomeSchema.statics.getByCategory = function(userId, category) {
  return this.find({ 
    userId: new mongoose.Types.ObjectId(userId), 
    category: category 
  }).sort({ date: -1 });
};

// Static method to get income by date range
incomeSchema.statics.getByDateRange = function(userId, startDate, endDate) {
  return this.find({
    userId: new mongoose.Types.ObjectId(userId),
    date: { $gte: new Date(startDate), $lte: new Date(endDate) }
  }).sort({ date: -1 });
};

// Static method to get recurring income due soon
incomeSchema.statics.getDueSoon = function(userId, daysAhead = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return this.find({
    userId: new mongoose.Types.ObjectId(userId),
    isRecurring: true,
    nextDueDate: { $lte: futureDate }
  }).sort({ nextDueDate: 1 });
};

const Income = mongoose.model('Income', incomeSchema);

module.exports = Income;