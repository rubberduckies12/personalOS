const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true // Keep this index
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxLength: 1000
  },
  category: {
    type: String,
    required: true,
    enum: [
      'financial',
      'health',
      'personal',
      'business',
      'education',
      'awards',
      'career',
      'relationships',
      'travel',
      'hobbies',
      'spiritual',
      'other'
    ]
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: function() {
      return this.category === 'business';
    }
  },
  status: {
    type: String,
    required: true,
    enum: ['not_started', 'in_progress', 'achieved', 'paused', 'cancelled'],
    default: 'not_started'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  roadmap: [{
    step: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date
    },
    dueDate: {
      type: Date
    },
    order: {
      type: Number,
      required: true
    }
  }],
  targetDate: {
    type: Date
  },
  startedAt: {
    type: Date
  },
  achievedAt: {
    type: Date
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  notes: [{
    content: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Removed duplicate indexes
// The following indexes were removed because they were redundant:
// - `goalSchema.index({ userId: 1, category: 1 });`
// - `goalSchema.index({ userId: 1, status: 1 });`
// - `goalSchema.index({ userId: 1, createdAt: -1 });`
// - `goalSchema.index({ userId: 1, businessId: 1 });`

// Optimized compound indexes for efficient queries
goalSchema.index({ userId: 1, category: 1, status: 1 });
goalSchema.index({ userId: 1, createdAt: -1 });

goalSchema.virtual('roadmapProgress').get(function() {
  if (!this.roadmap || this.roadmap.length === 0) return 0;
  const completedSteps = this.roadmap.filter(step => step.completed).length;
  return Math.round((completedSteps / this.roadmap.length) * 100);
});

goalSchema.pre('save', function(next) {
  if (this.roadmap && this.roadmap.length > 0) {
    const completedSteps = this.roadmap.filter(step => step.completed).length;
    this.progress = Math.round((completedSteps / this.roadmap.length) * 100);

    if (this.progress === 100 && this.status !== 'achieved') {
      this.status = 'achieved';
      this.achievedAt = new Date();
    } else if (this.progress > 0 && this.status === 'not_started') {
      this.status = 'in_progress';
      this.startedAt = new Date();
    }
  }

  if (this.isModified('status')) {
    if (this.status === 'in_progress' && !this.startedAt) {
      this.startedAt = new Date();
    } else if (this.status === 'achieved' && !this.achievedAt) {
      this.achievedAt = new Date();
    }
  }

  next();
});

goalSchema.statics.getByUser = function(userId, filters = {}) {
  const query = { userId, ...filters };
  return this.find(query).sort({ createdAt: -1 });
};

goalSchema.statics.getByCategory = function(userId, category) {
  return this.find({ userId, category }).sort({ priority: -1, createdAt: -1 });
};

goalSchema.statics.getActiveGoals = function(userId) {
  return this.find({
    userId,
    status: { $in: ['not_started', 'in_progress'] }
  }).sort({ priority: -1, createdAt: -1 });
};

goalSchema.statics.getAchievedGoals = function(userId) {
  return this.find({ userId, status: 'achieved' }).sort({ achievedAt: -1 });
};

goalSchema.statics.getByBusiness = function(userId, businessId) {
  return this.find({
    userId,
    category: 'business',
    businessId
  }).sort({ priority: -1, createdAt: -1 });
};

goalSchema.methods.addRoadmapStep = function(step, description, dueDate) {
  const order = this.roadmap.length + 1;
  this.roadmap.push({
    step,
    description,
    dueDate,
    order,
    completed: false
  });
  return this.save();
};

goalSchema.methods.completeRoadmapStep = function(stepIndex) {
  if (this.roadmap[stepIndex]) {
    this.roadmap[stepIndex].completed = true;
    this.roadmap[stepIndex].completedAt = new Date();
    return this.save();
  }
  throw new Error('Step not found');
};

goalSchema.methods.addNote = function(content) {
  this.notes.push({ content });
  return this.save();
};

goalSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  return this.save();
};

const Goal = mongoose.model('Goal', goalSchema);

module.exports = Goal;