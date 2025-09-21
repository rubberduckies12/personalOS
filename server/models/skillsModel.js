const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  description: {
    type: String,
    trim: true,
    maxLength: 1000
  },
  category: {
    type: String,
    required: true,
    enum: [
      'technical',
      'programming',
      'design',
      'business',
      'leadership',
      'communication',
      'language',
      'creative',
      'analytical',
      'personal',
      'physical',
      'academic',
      'trade',
      'other'
    ],
    index: true
  },
  subcategory: {
    type: String,
    trim: true,
    maxLength: 50
  },
  currentLevel: {
    type: String,
    required: true,
    enum: ['beginner', 'novice', 'intermediate', 'advanced', 'expert', 'master'],
    default: 'beginner',
    index: true
  },
  targetLevel: {
    type: String,
    required: true,
    enum: ['beginner', 'novice', 'intermediate', 'advanced', 'expert', 'master'],
    default: 'intermediate'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['not_started', 'learning', 'practicing', 'maintaining', 'mastered', 'on_hold'],
    default: 'not_started',
    index: true
  },
  // Progress tracking
  progressTracking: {
    type: {
      type: String,
      enum: ['percentage', 'hours', 'projects', 'certifications', 'custom'],
      default: 'percentage'
    },
    currentValue: {
      type: Number,
      default: 0,
      min: 0
    },
    targetValue: {
      type: Number,
      required: function() {
        return this.progressTracking?.type !== 'percentage';
      }
    },
    unit: {
      type: String,
      trim: true // "hours", "projects", "certificates", etc.
    },
    milestones: [{
      title: {
        type: String,
        required: true,
        trim: true
      },
      description: {
        type: String,
        trim: true
      },
      targetValue: {
        type: Number,
        required: true
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
    progressEntries: [{
      value: {
        type: Number,
        required: true
      },
      note: {
        type: String,
        trim: true
      },
      entryDate: {
        type: Date,
        default: Date.now
      },
      source: {
        type: String,
        enum: ['manual', 'project', 'reading', 'course', 'practice'],
        default: 'manual'
      }
    }]
  },
  // Linked resources
  linkedResources: {
    projects: [{
      projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
      },
      contribution: {
        type: String,
        trim: true,
        maxLength: 200
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    books: [{
      readingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Reading'
      },
      relevance: {
        type: String,
        enum: ['foundational', 'intermediate', 'advanced', 'reference'],
        default: 'foundational'
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    goals: [{
      goalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Goal'
      },
      relationship: {
        type: String,
        enum: ['supports', 'required_for', 'enhances'],
        default: 'supports'
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    businesses: [{
      businessId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Business'
      },
      application: {
        type: String,
        trim: true,
        maxLength: 200
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    courses: [{
      title: {
        type: String,
        required: true,
        trim: true
      },
      provider: {
        type: String,
        trim: true
      },
      url: {
        type: String,
        trim: true
      },
      status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed', 'paused'],
        default: 'not_started'
      },
      completedAt: {
        type: Date
      },
      certificateUrl: {
        type: String,
        trim: true
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  learningPlan: {
    phases: [{
      title: {
        type: String,
        required: true,
        trim: true
      },
      description: {
        type: String,
        trim: true
      },
      estimatedDuration: {
        type: Number, // weeks
        min: 0
      },
      tasks: [{
        task: {
          type: String,
          required: true,
          trim: true
        },
        completed: {
          type: Boolean,
          default: false
        },
        completedAt: {
          type: Date
        }
      }],
      order: {
        type: Number,
        required: true
      },
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: {
        type: Date
      }
    }],
    totalEstimatedTime: {
      type: Number, // weeks
      default: 0
    },
    startedAt: {
      type: Date
    },
    targetCompletionDate: {
      type: Date
    }
  },
  assessments: [{
    type: {
      type: String,
      enum: ['self_assessment', 'peer_review', 'certification', 'project_evaluation', 'other'],
      required: true
    },
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    level: {
      type: String,
      enum: ['beginner', 'novice', 'intermediate', 'advanced', 'expert', 'master']
    },
    notes: {
      type: String,
      trim: true
    },
    assessedBy: {
      type: String,
      trim: true
    },
    assessmentDate: {
      type: Date,
      default: Date.now
    },
    certificateUrl: {
      type: String,
      trim: true
    }
  }],
  practiceLog: [{
    activity: {
      type: String,
      required: true,
      trim: true
    },
    duration: {
      type: Number, // minutes
      required: true,
      min: 0
    },
    notes: {
      type: String,
      trim: true
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'challenging'],
      default: 'medium'
    },
    effectiveness: {
      type: Number,
      min: 1,
      max: 5
    },
    practiceDate: {
      type: Date,
      default: Date.now
    }
  }],
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
  archived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
skillSchema.index({ userId: 1, status: 1 });
skillSchema.index({ userId: 1, category: 1 });
skillSchema.index({ userId: 1, priority: 1 });
skillSchema.index({ userId: 1, currentLevel: 1 });
skillSchema.index({ userId: 1, archived: 1 });

// Virtual for progress percentage
skillSchema.virtual('progressPercentage').get(function() {
  if (this.progressTracking?.type === 'percentage') {
    return Math.min(100, this.progressTracking.currentValue || 0);
  } else if (this.progressTracking?.type === 'hours' || this.progressTracking?.type === 'projects') {
    const current = this.progressTracking.currentValue || 0;
    const target = this.progressTracking.targetValue || 1;
    return Math.min(100, Math.round((current / target) * 100));
  } else {
    // Calculate based on learning plan completion
    const phases = this.learningPlan?.phases || [];
    if (phases.length === 0) return 0;
    const completedPhases = phases.filter(phase => phase.completed).length;
    return Math.round((completedPhases / phases.length) * 100);
  }
});

// Virtual for total practice time
skillSchema.virtual('totalPracticeTime').get(function() {
  if (!this.practiceLog) return 0;
  return this.practiceLog.reduce((total, log) => total + log.duration, 0);
});

// Virtual for average practice effectiveness
skillSchema.virtual('avgPracticeEffectiveness').get(function() {
  const logsWithEffectiveness = this.practiceLog?.filter(log => log.effectiveness) || [];
  if (logsWithEffectiveness.length === 0) return 0;
  const sum = logsWithEffectiveness.reduce((total, log) => total + log.effectiveness, 0);
  return Math.round((sum / logsWithEffectiveness.length) * 10) / 10;
});

// Virtual for next learning phase
skillSchema.virtual('nextPhase').get(function() {
  const phases = this.learningPlan?.phases || [];
  return phases.find(phase => !phase.completed) || null;
});

// Pre-save middleware
skillSchema.pre('save', function(next) {
  // Update learning plan total estimated time
  if (this.learningPlan?.phases) {
    this.learningPlan.totalEstimatedTime = this.learningPlan.phases.reduce(
      (total, phase) => total + (phase.estimatedDuration || 0), 0
    );
  }
  
  // Auto-update status based on progress
  const progress = this.progressPercentage;
  if (progress === 100 && this.status !== 'mastered') {
    this.status = 'mastered';
  } else if (progress > 0 && this.status === 'not_started') {
    this.status = 'learning';
  }
  
  next();
});

// Static methods
skillSchema.statics.getByUser = function(userId, filters = {}) {
  const query = { userId, archived: false, ...filters };
  return this.find(query).sort({ priority: -1, createdAt: -1 });
};

skillSchema.statics.getByCategory = function(userId, category) {
  return this.find({ userId, category, archived: false }).sort({ priority: -1, currentLevel: 1 });
};

skillSchema.statics.getByStatus = function(userId, status) {
  return this.find({ userId, status, archived: false }).sort({ priority: -1 });
};

skillSchema.statics.getActiveSkills = function(userId) {
  return this.find({ 
    userId, 
    status: { $in: ['learning', 'practicing'] },
    archived: false 
  }).sort({ priority: -1, updatedAt: -1 });
};

skillSchema.statics.searchSkills = function(userId, searchTerm) {
  const regex = new RegExp(searchTerm, 'i');
  return this.find({
    userId,
    archived: false,
    $or: [
      { name: regex },
      { description: regex },
      { category: regex },
      { subcategory: regex },
      { tags: { $in: [regex] } }
    ]
  }).sort({ priority: -1 });
};

// Instance methods
skillSchema.methods.linkToProject = function(projectId, contribution = '') {
  const existingLink = this.linkedResources.projects.find(
    p => p.projectId.toString() === projectId.toString()
  );
  
  if (!existingLink) {
    this.linkedResources.projects.push({ projectId, contribution });
    return this.save();
  }
  
  throw new Error('Project already linked to this skill');
};

skillSchema.methods.linkToBook = function(readingId, relevance = 'foundational') {
  const existingLink = this.linkedResources.books.find(
    b => b.readingId.toString() === readingId.toString()
  );
  
  if (!existingLink) {
    this.linkedResources.books.push({ readingId, relevance });
    return this.save();
  }
  
  throw new Error('Book already linked to this skill');
};

skillSchema.methods.linkToGoal = function(goalId, relationship = 'supports') {
  const existingLink = this.linkedResources.goals.find(
    g => g.goalId.toString() === goalId.toString()
  );
  
  if (!existingLink) {
    this.linkedResources.goals.push({ goalId, relationship });
    return this.save();
  }
  
  throw new Error('Goal already linked to this skill');
};

skillSchema.methods.linkToBusiness = function(businessId, application = '') {
  const existingLink = this.linkedResources.businesses.find(
    b => b.businessId.toString() === businessId.toString()
  );
  
  if (!existingLink) {
    this.linkedResources.businesses.push({ businessId, application });
    return this.save();
  }
  
  throw new Error('Business already linked to this skill');
};

skillSchema.methods.addCourse = function(title, provider, url, status = 'not_started') {
  this.linkedResources.courses.push({ title, provider, url, status });
  return this.save();
};

skillSchema.methods.updateProgress = function(value, note = '', source = 'manual') {
  this.progressTracking.currentValue = value;
  this.progressTracking.progressEntries.push({
    value,
    note,
    source,
    entryDate: new Date()
  });
  return this.save();
};

skillSchema.methods.addPracticeSession = function(activity, duration, notes = '', difficulty = 'medium', effectiveness = null) {
  this.practiceLog.push({
    activity,
    duration,
    notes,
    difficulty,
    effectiveness,
    practiceDate: new Date()
  });
  return this.save();
};

skillSchema.methods.addAssessment = function(type, score, level, notes = '', assessedBy = '') {
  this.assessments.push({
    type,
    score,
    level,
    notes,
    assessedBy,
    assessmentDate: new Date()
  });
  
  // Update current level if assessment indicates higher level
  const levelOrder = ['beginner', 'novice', 'intermediate', 'advanced', 'expert', 'master'];
  const currentIndex = levelOrder.indexOf(this.currentLevel);
  const assessmentIndex = levelOrder.indexOf(level);
  
  if (assessmentIndex > currentIndex) {
    this.currentLevel = level;
  }
  
  return this.save();
};

skillSchema.methods.addLearningPhase = function(title, description, estimatedDuration, tasks = []) {
  const order = this.learningPlan.phases.length + 1;
  this.learningPlan.phases.push({
    title,
    description,
    estimatedDuration,
    tasks,
    order,
    completed: false
  });
  return this.save();
};

skillSchema.methods.completePhase = function(phaseIndex) {
  if (this.learningPlan.phases[phaseIndex]) {
    this.learningPlan.phases[phaseIndex].completed = true;
    this.learningPlan.phases[phaseIndex].completedAt = new Date();
    return this.save();
  }
  throw new Error('Phase not found');
};

skillSchema.methods.getSkillSummary = function() {
  return {
    name: this.name,
    currentLevel: this.currentLevel,
    targetLevel: this.targetLevel,
    progress: this.progressPercentage,
    totalPracticeTime: this.totalPracticeTime,
    avgEffectiveness: this.avgPracticeEffectiveness,
    linkedProjects: this.linkedResources.projects.length,
    linkedBooks: this.linkedResources.books.length,
    assessments: this.assessments.length,
    practiceSessionsCount: this.practiceLog.length
  };
};

const Skill = mongoose.model('Skill', skillSchema);

module.exports = Skill;