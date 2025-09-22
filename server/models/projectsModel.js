const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
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
    maxLength: 5000 // Longer description for projects
  },
  category: {
    type: String,
    enum: [
      'personal',
      'work',
      'business',
      'education',
      'research',
      'creative',
      'technical',
      'health',
      'home',
      'travel',
      'other'
    ],
    default: 'personal'
  },
  status: {
    type: String,
    required: true,
    enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
    default: 'planning'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  milestones: [{
    title: {
      type: String,
      required: true,
      trim: true,
      maxLength: 200
    },
    description: {
      type: String,
      trim: true,
      maxLength: 1000
    },
    dueDate: {
      type: Date
    },
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date
    },
    order: {
      type: Number,
      required: true
    },
    estimatedHours: {
      type: Number,
      min: 0
    },
    actualHours: {
      type: Number,
      min: 0
    },
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
    dependencies: [{
      type: Number // References other milestone orders
    }]
  }],
  startDate: {
    type: Date
  },
  targetCompletionDate: {
    type: Date
  },
  actualCompletionDate: {
    type: Date
  },
  estimatedTotalHours: {
    type: Number,
    min: 0
  },
  actualTotalHours: {
    type: Number,
    min: 0,
    default: 0
  },
  budget: {
    estimated: {
      type: Number,
      min: 0
    },
    actual: {
      type: Number,
      min: 0,
      default: 0
    },
    currency: {
      type: String,
      default: 'GBP'
    }
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  collaborators: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['owner', 'manager', 'contributor', 'viewer'],
      default: 'contributor'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  attachments: [{
    filename: String,
    url: String,
    type: {
      type: String,
      enum: ['document', 'image', 'video', 'audio', 'other'],
      default: 'document'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
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
  archived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Removed duplicate indexes
// The following indexes were removed because they were redundant:
// - `projectSchema.index({ userId: 1, status: 1 });`
// - `projectSchema.index({ userId: 1, category: 1 });`
// - `projectSchema.index({ userId: 1, createdAt: -1 });`
// - `projectSchema.index({ userId: 1, archived: 1 });`

// Optimized compound indexes for efficient queries
projectSchema.index({ userId: 1, status: 1, category: 1 });
projectSchema.index({ userId: 1, createdAt: -1 });

projectSchema.virtual('completionPercentage').get(function() {
  if (!this.milestones || this.milestones.length === 0) return 0;
  const completedMilestones = this.milestones.filter(milestone => milestone.completed).length;
  return Math.round((completedMilestones / this.milestones.length) * 100);
});

projectSchema.virtual('overdueMilestones').get(function() {
  if (!this.milestones) return [];
  const now = new Date();
  return this.milestones.filter(milestone => 
    !milestone.completed && 
    milestone.dueDate && 
    milestone.dueDate < now
  );
});

projectSchema.virtual('upcomingMilestones').get(function() {
  if (!this.milestones) return [];
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return this.milestones.filter(milestone => 
    !milestone.completed && 
    milestone.dueDate && 
    milestone.dueDate >= now && 
    milestone.dueDate <= nextWeek
  ).sort((a, b) => a.dueDate - b.dueDate);
});

projectSchema.virtual('nextMilestone').get(function() {
  if (!this.milestones) return null;
  return this.milestones
    .filter(milestone => !milestone.completed)
    .sort((a, b) => a.order - b.order)[0] || null;
});

projectSchema.pre('save', function(next) {
  if (this.milestones && this.milestones.length > 0) {
    this.actualTotalHours = this.milestones.reduce((total, milestone) => {
      return total + (milestone.actualHours || 0);
    }, 0);
  }

  if (this.milestones && this.milestones.length > 0) {
    const allCompleted = this.milestones.every(milestone => milestone.completed);
    if (allCompleted && this.status !== 'completed') {
      this.status = 'completed';
      this.actualCompletionDate = new Date();
    }
  }

  if (this.isModified('milestones') && !this.startDate) {
    const hasCompletedMilestone = this.milestones.some(milestone => milestone.completed);
    if (hasCompletedMilestone) {
      this.startDate = new Date();
    }
  }

  next();
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;