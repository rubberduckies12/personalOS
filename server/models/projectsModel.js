const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
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
    default: 'personal',
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
    default: 'planning',
    index: true
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

// Indexes for better query performance
projectSchema.index({ userId: 1, status: 1 });
projectSchema.index({ userId: 1, category: 1 });
projectSchema.index({ userId: 1, createdAt: -1 });
projectSchema.index({ userId: 1, archived: 1 });

// Virtual for completion percentage
projectSchema.virtual('completionPercentage').get(function() {
  if (!this.milestones || this.milestones.length === 0) return 0;
  const completedMilestones = this.milestones.filter(milestone => milestone.completed).length;
  return Math.round((completedMilestones / this.milestones.length) * 100);
});

// Virtual for overdue milestones
projectSchema.virtual('overdueMilestones').get(function() {
  if (!this.milestones) return [];
  const now = new Date();
  return this.milestones.filter(milestone => 
    !milestone.completed && 
    milestone.dueDate && 
    milestone.dueDate < now
  );
});

// Virtual for upcoming milestones (next 7 days)
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

// Virtual for next milestone
projectSchema.virtual('nextMilestone').get(function() {
  if (!this.milestones) return null;
  return this.milestones
    .filter(milestone => !milestone.completed)
    .sort((a, b) => a.order - b.order)[0] || null;
});

// Pre-save middleware
projectSchema.pre('save', function(next) {
  // Update actual total hours
  if (this.milestones && this.milestones.length > 0) {
    this.actualTotalHours = this.milestones.reduce((total, milestone) => {
      return total + (milestone.actualHours || 0);
    }, 0);
  }
  
  // Auto-complete project if all milestones are completed
  if (this.milestones && this.milestones.length > 0) {
    const allCompleted = this.milestones.every(milestone => milestone.completed);
    if (allCompleted && this.status !== 'completed') {
      this.status = 'completed';
      this.actualCompletionDate = new Date();
    }
  }
  
  // Set start date when first milestone is completed
  if (this.isModified('milestones') && !this.startDate) {
    const hasCompletedMilestone = this.milestones.some(milestone => milestone.completed);
    if (hasCompletedMilestone) {
      this.startDate = new Date();
    }
  }
  
  next();
});

// Static methods
projectSchema.statics.getByUser = function(userId, filters = {}) {
  const query = { userId, archived: false, ...filters };
  return this.find(query).sort({ createdAt: -1 });
};

projectSchema.statics.getByStatus = function(userId, status) {
  return this.find({ userId, status, archived: false }).sort({ createdAt: -1 });
};

projectSchema.statics.getByCategory = function(userId, category) {
  return this.find({ userId, category, archived: false }).sort({ priority: -1, createdAt: -1 });
};

projectSchema.statics.getActive = function(userId) {
  return this.find({ 
    userId, 
    status: { $in: ['planning', 'active'] },
    archived: false 
  }).sort({ priority: -1, createdAt: -1 });
};

projectSchema.statics.getCompleted = function(userId) {
  return this.find({ 
    userId, 
    status: 'completed',
    archived: false 
  }).sort({ actualCompletionDate: -1 });
};

projectSchema.statics.getWithOverdueMilestones = function(userId) {
  const now = new Date();
  return this.find({
    userId,
    archived: false,
    status: { $in: ['planning', 'active'] },
    'milestones.dueDate': { $lt: now },
    'milestones.completed': false
  });
};

// Instance methods
projectSchema.methods.addMilestone = function(title, description, dueDate, estimatedHours) {
  const order = this.milestones.length + 1;
  this.milestones.push({
    title,
    description,
    dueDate,
    estimatedHours,
    order,
    completed: false,
    notes: [],
    dependencies: []
  });
  return this.save();
};

projectSchema.methods.completeMilestone = function(milestoneIndex, actualHours) {
  if (this.milestones[milestoneIndex]) {
    this.milestones[milestoneIndex].completed = true;
    this.milestones[milestoneIndex].completedAt = new Date();
    if (actualHours !== undefined) {
      this.milestones[milestoneIndex].actualHours = actualHours;
    }
    return this.save();
  }
  throw new Error('Milestone not found');
};

projectSchema.methods.reorderMilestones = function(newOrder) {
  // newOrder should be an array of milestone indices in the desired order
  const reorderedMilestones = newOrder.map((index, newIndex) => {
    const milestone = this.milestones[index];
    milestone.order = newIndex + 1;
    return milestone;
  });
  this.milestones = reorderedMilestones;
  return this.save();
};

projectSchema.methods.addMilestoneNote = function(milestoneIndex, content) {
  if (this.milestones[milestoneIndex]) {
    this.milestones[milestoneIndex].notes.push({ content });
    return this.save();
  }
  throw new Error('Milestone not found');
};

projectSchema.methods.addNote = function(content) {
  this.notes.push({ content });
  return this.save();
};

projectSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  if (newStatus === 'completed' && !this.actualCompletionDate) {
    this.actualCompletionDate = new Date();
  }
  return this.save();
};

projectSchema.methods.addCollaborator = function(userId, role = 'contributor') {
  // Check if user is already a collaborator
  const existingCollaborator = this.collaborators.find(
    collab => collab.userId.toString() === userId.toString()
  );
  
  if (!existingCollaborator) {
    this.collaborators.push({ userId, role });
    return this.save();
  }
  
  throw new Error('User is already a collaborator');
};

projectSchema.methods.removeCollaborator = function(userId) {
  this.collaborators = this.collaborators.filter(
    collab => collab.userId.toString() !== userId.toString()
  );
  return this.save();
};

projectSchema.methods.archive = function() {
  this.archived = true;
  return this.save();
};

projectSchema.methods.unarchive = function() {
  this.archived = false;
  return this.save();
};

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;