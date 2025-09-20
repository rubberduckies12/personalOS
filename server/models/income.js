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
  collection: 'incomes'
});

// Compound index for user and date queries
incomeSchema.index({ userId: 1, date: -1 });
incomeSchema.index({ userId: 1, category: 1 });

// Instance method to format amount
incomeSchema.methods.getFormattedAmount = function() {
  return `$${this.amount.toFixed(2)}`;
};

// Static method to get user's total income
incomeSchema.statics.getTotalByUser = async function(userId, startDate, endDate) {
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

// Static method to get income by category for a user
incomeSchema.statics.getByCategory = function(userId, category) {
  return this.find({ 
    userId: new mongoose.Types.ObjectId(userId), 
    category: category 
  }).sort({ date: -1 });
};

const Income = mongoose.model('Income', incomeSchema);

module.exports = Income;