const mongoose = require('mongoose');

const readingSessionSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  duration: {
    type: Number, // minutes
    required: true,
    min: 0
  },
  pagesRead: {
    type: Number,
    default: 0,
    min: 0
  },
  startPage: {
    type: Number,
    min: 0
  },
  endPage: {
    type: Number,
    min: 0
  },
  notes: {
    type: String,
    trim: true,
    maxLength: 500
  }
});

const readingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxLength: 300
  },
  author: {
    type: String,
    trim: true,
    maxLength: 200,
    default: ''
  },
  description: {
    type: String,
    trim: true,
    maxLength: 2000,
    default: ''
  },
  type: {
    type: String,
    enum: ['book', 'article', 'audiobook', 'magazine', 'paper', 'other'],
    default: 'book',
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['to_read', 'reading', 'completed', 'on_hold', 'abandoned'],
    default: 'to_read',
    index: true
  },
  genre: {
    type: String,
    enum: [
      'fiction',
      'non-fiction',
      'biography',
      'business',
      'self-help',
      'science',
      'history',
      'philosophy',
      'technology',
      'health',
      'education',
      'thriller',
      'romance',
      'fantasy',
      'mystery',
      'psychology',
      'economics',
      'politics',
      'religion',
      'art',
      'other'
    ],
    default: 'other'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  totalPages: {
    type: Number,
    min: 1
  },
  currentPage: {
    type: Number,
    default: 0,
    min: 0
  },
  progressPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  averagePageTime: {
    type: Number, // minutes per page - user customizable
    default: 3,
    min: 0.5,
    max: 30
  },
  isbn: {
    type: String,
    trim: true
  },
  publisher: {
    type: String,
    trim: true,
    maxLength: 200
  },
  publishedDate: {
    type: Date
  },
  targetDate: {
    type: Date,
    index: true
  },
  goalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Goal',
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    trim: true,
    maxLength: 2000
  },
  notes: {
    type: String,
    trim: true,
    maxLength: 2000
  },
  startedAt: {
    type: Date,
    index: true
  },
  completedAt: {
    type: Date,
    index: true
  },
  sessions: [readingSessionSchema],
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// CRITICAL PERFORMANCE INDEXES
// Basic user filtering
readingSchema.index({ userId: 1 });

// Status filtering with compound indexes
readingSchema.index({ userId: 1, status: 1 });
readingSchema.index({ userId: 1, status: 1, completedAt: -1 });
readingSchema.index({ userId: 1, status: 1, updatedAt: -1 });

// Dashboard query optimization
readingSchema.index({ userId: 1, type: 1, status: 1 });
readingSchema.index({ userId: 1, genre: 1, completedAt: -1 });

// Heatmap and session queries
readingSchema.index({ userId: 1, 'sessions.date': -1 });
readingSchema.index({ 'sessions.date': 1 }, { sparse: true });

// Timeline and analytics
readingSchema.index({ userId: 1, startedAt: 1, completedAt: 1 });
readingSchema.index({ userId: 1, targetDate: 1 });

// Completed items for aggregations (partial index for performance)
readingSchema.index({ 
  userId: 1, 
  completedAt: -1 
}, { 
  partialFilterExpression: { status: 'completed' } 
});

// Search optimization
readingSchema.index({ 
  userId: 1,
  title: 'text', 
  author: 'text', 
  description: 'text' 
}, {
  weights: { title: 10, author: 5, description: 1 }
});

// Compound index for dashboard overview queries
readingSchema.index({ 
  userId: 1, 
  status: 1, 
  type: 1,
  completedAt: -1 
});

// Virtual for reading velocity
readingSchema.virtual('readingVelocity').get(function() {
  if (!this.startedAt || this.currentPage <= 0) return 0;
  const daysReading = Math.ceil((new Date() - new Date(this.startedAt)) / (1000 * 60 * 60 * 24));
  return daysReading > 0 ? Math.round(this.currentPage / daysReading * 10) / 10 : 0;
});

// Virtual for estimated completion time
readingSchema.virtual('estimatedTimeRemaining').get(function() {
  if (!this.totalPages || this.currentPage >= this.totalPages) return 0;
  const remainingPages = this.totalPages - this.currentPage;
  return Math.round(remainingPages * this.averagePageTime);
});

// Virtual for overdue status
readingSchema.virtual('isOverdue').get(function() {
  return this.targetDate && 
         new Date(this.targetDate) < new Date() && 
         this.status !== 'completed';
});

// Pre-save middleware to calculate progress
readingSchema.pre('save', function(next) {
  if (this.totalPages && this.totalPages > 0) {
    this.progressPercentage = Math.round((this.currentPage / this.totalPages) * 100);
  }
  next();
});

module.exports = mongoose.model('Reading', readingSchema);