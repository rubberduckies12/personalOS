const mongoose = require('mongoose');

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
    required: true,
    trim: true,
    maxLength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxLength: 2000
  },
  totalChapters: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    required: true,
    enum: ['not_started', 'reading', 'completed', 'on_hold', 'abandoned'],
    default: 'not_started',
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
      'other'
    ],
    default: 'other'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  chapters: [{
    chapterNumber: {
      type: Number,
      required: true,
      min: 1
    },
    title: {
      type: String,
      trim: true,
      maxLength: 200
    },
    summary: {
      type: String,
      trim: true,
      maxLength: 1000,
      required: function() {
        return this.completed;
      }
    },
    keyTakeaways: [{
      type: String,
      trim: true,
      maxLength: 300
    }],
    notes: [{
      content: {
        type: String,
        required: true,
        maxLength: 500
      },
      pageNumber: {
        type: Number,
        min: 1
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date
    },
    readingTime: {
      type: Number, // minutes
      min: 0
    }
  }],
  overallSummary: {
    type: String,
    trim: true,
    maxLength: 2000,
    required: function() {
      return this.status === 'completed';
    }
  },
  overallRating: {
    type: Number,
    min: 1,
    max: 5
  },
  keyLessons: [{
    type: String,
    trim: true,
    maxLength: 500
  }],
  quotes: [{
    text: {
      type: String,
      required: true,
      maxLength: 500
    },
    pageNumber: {
      type: Number,
      min: 1
    },
    chapterNumber: {
      type: Number,
      min: 1
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isbn: {
    type: String,
    trim: true
  },
  publisher: {
    type: String,
    trim: true,
    maxLength: 200
  },
  publishedYear: {
    type: Number,
    min: 1000,
    max: new Date().getFullYear() + 10
  },
  totalPages: {
    type: Number,
    min: 1
  },
  format: {
    type: String,
    enum: ['physical', 'ebook', 'audiobook'],
    default: 'physical'
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  totalReadingTime: {
    type: Number, // total minutes spent reading
    default: 0
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  recommendations: [{
    bookTitle: {
      type: String,
      required: true,
      trim: true
    },
    author: {
      type: String,
      required: true,
      trim: true
    },
    reason: {
      type: String,
      trim: true,
      maxLength: 300
    }
  }],
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
readingSchema.index({ userId: 1, status: 1 });
readingSchema.index({ userId: 1, genre: 1 });
readingSchema.index({ userId: 1, createdAt: -1 });
readingSchema.index({ author: 1 });
readingSchema.index({ genre: 1, status: 1 });

// Virtual for reading progress percentage
readingSchema.virtual('progressPercentage').get(function() {
  if (!this.chapters || this.chapters.length === 0) return 0;
  const completedChapters = this.chapters.filter(chapter => chapter.completed).length;
  return Math.round((completedChapters / this.totalChapters) * 100);
});

// Virtual for chapters completed count
readingSchema.virtual('chaptersCompleted').get(function() {
  if (!this.chapters) return 0;
  return this.chapters.filter(chapter => chapter.completed).length;
});

// Virtual for current chapter
readingSchema.virtual('currentChapter').get(function() {
  if (!this.chapters) return null;
  return this.chapters.find(chapter => !chapter.completed) || null;
});

// Virtual for next chapter number
readingSchema.virtual('nextChapterNumber').get(function() {
  const completed = this.chaptersCompleted;
  return completed < this.totalChapters ? completed + 1 : null;
});

// Virtual for average reading time per chapter
readingSchema.virtual('avgReadingTimePerChapter').get(function() {
  if (!this.chapters || this.chapters.length === 0) return 0;
  const chaptersWithTime = this.chapters.filter(ch => ch.readingTime > 0);
  if (chaptersWithTime.length === 0) return 0;
  const totalTime = chaptersWithTime.reduce((sum, ch) => sum + ch.readingTime, 0);
  return Math.round(totalTime / chaptersWithTime.length);
});

// Pre-save middleware
readingSchema.pre('save', function(next) {
  // Auto-populate chapters array if not exists
  if (!this.chapters || this.chapters.length === 0) {
    this.chapters = Array.from({ length: this.totalChapters }, (_, index) => ({
      chapterNumber: index + 1,
      completed: false,
      notes: [],
      keyTakeaways: []
    }));
  }
  
  // Update status based on progress
  const completedChapters = this.chapters.filter(ch => ch.completed).length;
  
  if (completedChapters === 0 && this.status === 'reading') {
    // If no chapters completed but status is reading, keep it
  } else if (completedChapters > 0 && this.status === 'not_started') {
    this.status = 'reading';
    if (!this.startedAt) {
      this.startedAt = new Date();
    }
  } else if (completedChapters === this.totalChapters && this.status !== 'completed') {
    this.status = 'completed';
    this.completedAt = new Date();
  }
  
  // Calculate total reading time
  this.totalReadingTime = this.chapters.reduce((total, chapter) => {
    return total + (chapter.readingTime || 0);
  }, 0);
  
  next();
});

// Static methods
readingSchema.statics.getByUser = function(userId, filters = {}) {
  const query = { userId, ...filters };
  return this.find(query).sort({ createdAt: -1 });
};

readingSchema.statics.getByStatus = function(userId, status) {
  return this.find({ userId, status }).sort({ createdAt: -1 });
};

readingSchema.statics.getByGenre = function(userId, genre) {
  return this.find({ userId, genre }).sort({ priority: -1, createdAt: -1 });
};

readingSchema.statics.getCurrentlyReading = function(userId) {
  return this.find({ userId, status: 'reading' }).sort({ updatedAt: -1 });
};

readingSchema.statics.getCompleted = function(userId) {
  return this.find({ userId, status: 'completed' }).sort({ completedAt: -1 });
};

readingSchema.statics.getToRead = function(userId) {
  return this.find({ userId, status: 'not_started' }).sort({ priority: -1, createdAt: -1 });
};

readingSchema.statics.searchBooks = function(userId, searchTerm) {
  const regex = new RegExp(searchTerm, 'i');
  return this.find({
    userId,
    $or: [
      { title: regex },
      { author: regex },
      { description: regex },
      { tags: { $in: [regex] } }
    ]
  }).sort({ createdAt: -1 });
};

// Instance methods
readingSchema.methods.startReading = function() {
  this.status = 'reading';
  if (!this.startedAt) {
    this.startedAt = new Date();
  }
  return this.save();
};

readingSchema.methods.completeChapter = function(chapterNumber, summary, readingTime, keyTakeaways = []) {
  const chapter = this.chapters.find(ch => ch.chapterNumber === chapterNumber);
  if (!chapter) {
    throw new Error('Chapter not found');
  }
  
  if (!summary || summary.trim().length === 0) {
    throw new Error('Chapter summary is required to mark chapter as complete');
  }
  
  chapter.summary = summary;
  chapter.completed = true;
  chapter.completedAt = new Date();
  chapter.readingTime = readingTime || 0;
  chapter.keyTakeaways = keyTakeaways;
  
  return this.save();
};

readingSchema.methods.addChapterNote = function(chapterNumber, content, pageNumber) {
  const chapter = this.chapters.find(ch => ch.chapterNumber === chapterNumber);
  if (!chapter) {
    throw new Error('Chapter not found');
  }
  
  chapter.notes.push({ content, pageNumber });
  return this.save();
};

readingSchema.methods.addQuote = function(text, pageNumber, chapterNumber) {
  this.quotes.push({ text, pageNumber, chapterNumber });
  return this.save();
};

readingSchema.methods.completeBook = function(overallSummary, rating, keyLessons = []) {
  if (!overallSummary || overallSummary.trim().length === 0) {
    throw new Error('Overall summary is required to complete the book');
  }
  
  const incompletedChapters = this.chapters.filter(ch => !ch.completed);
  if (incompletedChapters.length > 0) {
    throw new Error('All chapters must be completed before finishing the book');
  }
  
  this.overallSummary = overallSummary;
  this.overallRating = rating;
  this.keyLessons = keyLessons;
  this.status = 'completed';
  this.completedAt = new Date();
  
  return this.save();
};

readingSchema.methods.addRecommendation = function(bookTitle, author, reason) {
  this.recommendations.push({ bookTitle, author, reason });
  return this.save();
};

readingSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  
  if (newStatus === 'reading' && !this.startedAt) {
    this.startedAt = new Date();
  } else if (newStatus === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  return this.save();
};

readingSchema.methods.getChapterSummaries = function() {
  return this.chapters
    .filter(ch => ch.completed && ch.summary)
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
    .map(ch => ({
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      summary: ch.summary,
      keyTakeaways: ch.keyTakeaways
    }));
};

const Reading = mongoose.model('Reading', readingSchema);

module.exports = Reading;