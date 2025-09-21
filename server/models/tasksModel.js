const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
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
    trim: true,
    maxLength: 1000
  },
  status: {
    type: String,
    required: true,
    enum: ['not_started', 'in_progress', 'completed', 'cancelled', 'on_hold'],
    default: 'not_started',
    index: true
  },
  // Eisenhower Matrix - Urgency and Importance
  urgency: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  importance: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  deadline: {
    type: Date,
    index: true
  },
  estimatedTime: {
    type: Number, // minutes
    min: 0
  },
  actualTime: {
    type: Number, // minutes
    min: 0
  },
  // Linking capabilities
  linkedTo: {
    type: {
      type: String,
      enum: ['project', 'goal', 'business', 'none'],
      default: 'none'
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: function() {
        return this.linkedTo?.type === 'project';
      }
    },
    goalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Goal',
      required: function() {
        return this.linkedTo?.type === 'goal';
      }
    },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: function() {
        return this.linkedTo?.type === 'business';
      }
    },
    milestoneIndex: {
      type: Number, // For project milestones
      min: 0
    }
  },
  category: {
    type: String,
    enum: [
      'work',
      'personal',
      'health',
      'finance',
      'education',
      'household',
      'social',
      'creative',
      'administrative',
      'maintenance',
      'shopping',
      'other'
    ],
    default: 'personal',
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  subtasks: [{
    title: {
      type: String,
      required: true,
      trim: true,
      maxLength: 200
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
    }
  }],
  notes: [{
    content: {
      type: String,
      required: true,
      maxLength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  reminders: [{
    reminderTime: {
      type: Date,
      required: true
    },
    message: {
      type: String,
      trim: true,
      maxLength: 200
    },
    sent: {
      type: Boolean,
      default: false
    }
  }],
  recurring: {
    isRecurring: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      required: function() {
        return this.recurring?.isRecurring;
      }
    },
    interval: {
      type: Number,
      default: 1,
      min: 1
    },
    endDate: {
      type: Date
    },
    nextDue: {
      type: Date
    }
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  dependencies: [{
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task'
    },
    type: {
      type: String,
      enum: ['blocks', 'subtask_of', 'related_to'],
      default: 'blocks'
    }
  }],
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient querying
taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ userId: 1, urgency: 1, importance: 1 });
taskSchema.index({ userId: 1, deadline: 1 });
taskSchema.index({ userId: 1, category: 1 });
taskSchema.index({ userId: 1, 'linkedTo.type': 1 });
taskSchema.index({ userId: 1, 'linkedTo.projectId': 1 });
taskSchema.index({ userId: 1, 'linkedTo.goalId': 1 });
taskSchema.index({ userId: 1, 'linkedTo.businessId': 1 });

// Virtual for Eisenhower Matrix quadrant
taskSchema.virtual('eisenhowerQuadrant').get(function() {
  const urgencyLevel = ['low', 'medium', 'high', 'critical'].indexOf(this.urgency);
  const importanceLevel = ['low', 'medium', 'high', 'critical'].indexOf(this.importance);
  
  if (urgencyLevel >= 2 && importanceLevel >= 2) return 'Q1'; // Do First (urgent + important)
  if (urgencyLevel < 2 && importanceLevel >= 2) return 'Q2'; // Schedule (not urgent + important)
  if (urgencyLevel >= 2 && importanceLevel < 2) return 'Q3'; // Delegate (urgent + not important)
  return 'Q4'; // Eliminate (not urgent + not important)
});

// Virtual for priority score (for sorting)
taskSchema.virtual('priorityScore').get(function() {
  const urgencyWeight = ['low', 'medium', 'high', 'critical'].indexOf(this.urgency) + 1;
  const importanceWeight = ['low', 'medium', 'high', 'critical'].indexOf(this.importance) + 1;
  
  // Importance weighs more heavily
  return (importanceWeight * 3) + (urgencyWeight * 2);
});

// Virtual for overdue status
taskSchema.virtual('isOverdue').get(function() {
  return this.deadline && this.deadline < new Date() && this.status !== 'completed';
});

// Virtual for subtask progress
taskSchema.virtual('subtaskProgress').get(function() {
  if (!this.subtasks || this.subtasks.length === 0) return 100;
  const completed = this.subtasks.filter(st => st.completed).length;
  return Math.round((completed / this.subtasks.length) * 100);
});

// Virtual for days until deadline
taskSchema.virtual('daysUntilDeadline').get(function() {
  if (!this.deadline) return null;
  const now = new Date();
  const diffTime = this.deadline - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
taskSchema.pre('save', function(next) {
  // Set startedAt when status changes to in_progress
  if (this.isModified('status')) {
    if (this.status === 'in_progress' && !this.startedAt) {
      this.startedAt = new Date();
    } else if (this.status === 'completed' && !this.completedAt) {
      this.completedAt = new Date();
    }
  }
  
  // Update recurring tasks
  if (this.recurring?.isRecurring && this.status === 'completed' && !this.recurring.nextDue) {
    const nextDue = new Date(this.completedAt || new Date());
    switch (this.recurring.frequency) {
      case 'daily':
        nextDue.setDate(nextDue.getDate() + this.recurring.interval);
        break;
      case 'weekly':
        nextDue.setDate(nextDue.getDate() + (7 * this.recurring.interval));
        break;
      case 'monthly':
        nextDue.setMonth(nextDue.getMonth() + this.recurring.interval);
        break;
      case 'yearly':
        nextDue.setFullYear(nextDue.getFullYear() + this.recurring.interval);
        break;
    }
    this.recurring.nextDue = nextDue;
  }
  
  next();
});

// Static methods
taskSchema.statics.getByUser = function(userId, filters = {}) {
  const query = { userId, isArchived: false, ...filters };
  return this.find(query).sort({ priorityScore: -1, deadline: 1, createdAt: -1 });
};

taskSchema.statics.getByEisenhowerQuadrant = function(userId, quadrant) {
  const conditions = {
    Q1: { urgency: { $in: ['high', 'critical'] }, importance: { $in: ['high', 'critical'] } },
    Q2: { urgency: { $in: ['low', 'medium'] }, importance: { $in: ['high', 'critical'] } },
    Q3: { urgency: { $in: ['high', 'critical'] }, importance: { $in: ['low', 'medium'] } },
    Q4: { urgency: { $in: ['low', 'medium'] }, importance: { $in: ['low', 'medium'] } }
  };
  
  return this.find({ 
    userId, 
    isArchived: false,
    status: { $ne: 'completed' },
    ...conditions[quadrant] 
  }).sort({ deadline: 1, createdAt: -1 });
};

taskSchema.statics.getOverdue = function(userId) {
  return this.find({
    userId,
    isArchived: false,
    status: { $ne: 'completed' },
    deadline: { $lt: new Date() }
  });
};

taskSchema.statics.getDueToday = function(userId) {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));
  
  return this.find({
    userId,
    isArchived: false,
    status: { $ne: 'completed' },
    deadline: { $gte: startOfDay, $lte: endOfDay }
  });
};

taskSchema.statics.getByProject = function(userId, projectId) {
  return this.find({
    userId,
    isArchived: false,
    'linkedTo.type': 'project',
    'linkedTo.projectId': projectId
  }).sort({ priorityScore: -1, deadline: 1 });
};

taskSchema.statics.getByGoal = function(userId, goalId) {
  return this.find({
    userId,
    isArchived: false,
    'linkedTo.type': 'goal',
    'linkedTo.goalId': goalId
  }).sort({ priorityScore: -1, deadline: 1 });
};

taskSchema.statics.getByBusiness = function(userId, businessId) {
  return this.find({
    userId,
    isArchived: false,
    'linkedTo.type': 'business',
    'linkedTo.businessId': businessId
  }).sort({ priorityScore: -1, deadline: 1 });
};

// Instance methods
taskSchema.methods.linkToProject = function(projectId, milestoneIndex = null) {
  this.linkedTo = {
    type: 'project',
    projectId,
    milestoneIndex
  };
  return this.save();
};

taskSchema.methods.linkToGoal = function(goalId) {
  this.linkedTo = {
    type: 'goal',
    goalId
  };
  return this.save();
};

taskSchema.methods.linkToBusiness = function(businessId) {
  this.linkedTo = {
    type: 'business',
    businessId
  };
  return this.save();
};

taskSchema.methods.unlinkFromAll = function() {
  this.linkedTo = { type: 'none' };
  return this.save();
};

taskSchema.methods.addSubtask = function(title) {
  const order = this.subtasks.length + 1;
  this.subtasks.push({ title, order, completed: false });
  return this.save();
};

taskSchema.methods.completeSubtask = function(subtaskIndex) {
  if (this.subtasks[subtaskIndex]) {
    this.subtasks[subtaskIndex].completed = true;
    this.subtasks[subtaskIndex].completedAt = new Date();
    return this.save();
  }
  throw new Error('Subtask not found');
};

taskSchema.methods.addNote = function(content) {
  this.notes.push({ content });
  return this.save();
};

taskSchema.methods.updateStatus = function(newStatus, actualTime = null) {
  const oldStatus = this.status;
  this.status = newStatus;
  
  // Set timestamps
  if (newStatus === 'in_progress' && !this.startedAt) {
    this.startedAt = new Date();
  } else if (newStatus === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  // Update actual time if provided
  if (actualTime !== null) {
    this.actualTime = actualTime;
  }
  
  return this.save();
};

taskSchema.methods.setReminder = function(reminderTime, message = '') {
  this.reminders.push({ reminderTime, message });
  return this.save();
};

taskSchema.methods.archive = function() {
  this.isArchived = true;
  return this.save();
};

taskSchema.methods.createRecurringInstance = async function() {
  if (!this.recurring?.isRecurring) {
    throw new Error('Task is not set up for recurring');
  }
  
  // Calculate next due date
  const nextDue = new Date(this.completedAt || new Date());
  switch (this.recurring.frequency) {
    case 'daily':
      nextDue.setDate(nextDue.getDate() + this.recurring.interval);
      break;
    case 'weekly':
      nextDue.setDate(nextDue.getDate() + (7 * this.recurring.interval));
      break;
    case 'monthly':
      nextDue.setMonth(nextDue.getMonth() + this.recurring.interval);
      break;
    case 'yearly':
      nextDue.setFullYear(nextDue.getFullYear() + this.recurring.interval);
      break;
  }
  
  // Create new task instance
  const newTaskData = {
    ...this.toObject(),
    _id: undefined,
    status: 'not_started',
    startedAt: null,
    completedAt: null,
    deadline: nextDue,
    subtasks: this.subtasks.map(st => ({ 
      ...st, 
      completed: false, 
      completedAt: null 
    })),
    notes: [],
    recurring: {
      ...this.recurring,
      nextDue: null
    },
    createdAt: undefined,
    updatedAt: undefined
  };
  
  const newTask = new this.constructor(newTaskData);
  
  // Update current task's next due
  this.recurring.nextDue = nextDue;
  
  // Save both tasks
  await this.save();
  await newTask.save();
  
  return [this, newTask]; // Return format expected by route
};

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;