const mongoose = require('mongoose');

// URL Schema for multiple business URLs
const urlSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['website', 'social_media', 'portfolio', 'store', 'documentation', 'blog', 'support', 'other'],
    default: 'website'
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Please enter a valid URL starting with http:// or https://'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  }
}, { _id: true });

// Product Schema
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['physical', 'digital', 'service', 'subscription', 'course', 'consulting', 'software', 'other'],
    default: 'other'
  },
  status: {
    type: String,
    enum: ['development', 'active', 'discontinued', 'planned'],
    default: 'development'
  },
  pricing: {
    type: {
      type: String,
      enum: ['free', 'one_time', 'subscription', 'usage_based', 'custom'],
      default: 'one_time'
    },
    amount: {
      type: Number,
      min: 0,
      default: 0
    },
    currency: {
      type: String,
      enum: ['GBP', 'USD', 'EUR', 'CAD', 'AUD'],
      default: 'GBP'
    },
    billingPeriod: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      default: 'monthly'
    }
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  launchDate: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metrics: {
    totalSales: {
      type: Number,
      default: 0
    },
    activeUsers: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0
    }
  }
}, { _id: true, timestamps: true });

// Team Member Schema for inviting users - FIXED EMAIL REQUIREMENT
const teamMemberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    sparse: true // Allows null for pending invitations
  },
  email: {
    type: String,
    required: function() {
      // Email is required only if userId is not set (pending invitations)
      return !this.userId;
    },
    trim: true,
    lowercase: true
  },
  role: {
    type: String,
    required: true,
    enum: ['owner', 'admin', 'manager', 'member', 'viewer', 'consultant'],
    default: 'member'
  },
  permissions: [{
    type: String,
    enum: [
      'view_business', 'edit_business', 'delete_business',
      'manage_products', 'view_products',
      'manage_projects', 'view_projects',
      'manage_team', 'invite_users',
      'view_analytics', 'manage_integrations'
    ]
  }],
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive', 'removed'],
    default: 'pending'
  },
  invitedAt: {
    type: Date,
    default: Date.now
  },
  joinedAt: {
    type: Date
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  inviteToken: {
    type: String,
    sparse: true
  },
  inviteExpiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    }
  }
}, { _id: true, timestamps: true });

// Main Business Schema
const businessSchema = new mongoose.Schema({
  // Basic Business Information
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 2000
  },
  industry: {
    type: String,
    enum: [
      'technology', 'healthcare', 'finance', 'education', 'retail', 'manufacturing',
      'real_estate', 'food_beverage', 'transportation', 'entertainment', 'consulting',
      'marketing', 'construction', 'agriculture', 'energy', 'telecommunications',
      'legal', 'non_profit', 'government', 'other'
    ],
    default: 'other'
  },
  businessType: {
    type: String,
    enum: ['sole_proprietor', 'partnership', 'llc', 'corporation', 's_corp', 'non_profit', 'other'],
    default: 'sole_proprietor'
  },
  stage: {
    type: String,
    enum: ['idea', 'startup', 'growth', 'established', 'enterprise', 'scaling'],
    default: 'idea'
  },
  
  // Owner and Team - FIXED TO USE 'Account'
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account', // Changed from 'User' to 'Account'
    required: true
  },
  teamMembers: [teamMemberSchema],
  
  // Business Details
  foundedDate: {
    type: Date
  },
  location: {
    country: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    postalCode: {
      type: String,
      trim: true
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  
  // Contact Information
  contact: {
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    website: {
      type: String,
      trim: true
    }
  },
  
  // Multiple URLs
  urls: [urlSchema],
  
  // Products and Services
  products: [productSchema],
  
  // Linked Projects
  linkedProjects: [{
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    role: {
      type: String,
      enum: ['primary', 'supporting', 'related', 'dependency'],
      default: 'related'
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium'
    },
    businessPhase: {
      type: String,
      enum: ['research', 'development', 'launch', 'growth', 'maintenance'],
      default: 'development'
    },
    expectedImpact: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    },
    linkedAt: {
      type: Date,
      default: Date.now
    },
    linkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true
    },
    // Roadmap positioning
    roadmapPosition: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      lane: { type: String, default: 'development' } // For swimlanes
    },
    // Dependencies between business projects
    dependencies: [{
      projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
      },
      type: {
        type: String,
        enum: ['blocks', 'enables', 'supports'],
        default: 'supports'
      }
    }]
  }],
  
  // Business Metrics and Goals
  metrics: {
    targetRevenue: {
      annual: {
        type: Number,
        min: 0
      },
      monthly: {
        type: Number,
        min: 0
      },
      currency: {
        type: String,
        enum: ['GBP', 'USD', 'EUR', 'CAD', 'AUD'],
        default: 'GBP'
      }
    },
    currentRevenue: {
      annual: {
        type: Number,
        default: 0
      },
      monthly: {
        type: Number,
        default: 0
      }
    },
    targetCustomers: {
      type: Number,
      min: 0
    },
    currentCustomers: {
      type: Number,
      default: 0
    },
    employeeCount: {
      target: {
        type: Number,
        min: 0
      },
      current: {
        type: Number,
        default: 1
      }
    }
  },
  
  // Business Status and Settings
  status: {
    type: String,
    enum: ['active', 'inactive', 'paused', 'closed'],
    default: 'active'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  
  // Tags and Categories
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // Business Plan and Notes
  businessPlan: {
    vision: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    mission: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    values: [{
      type: String,
      trim: true
    }],
    targetMarket: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    competitiveAdvantage: {
      type: String,
      trim: true,
      maxlength: 1000
    }
  },
  
  // Integration Settings
  integrations: {
    analytics: {
      googleAnalytics: {
        trackingId: String,
        isActive: { type: Boolean, default: false }
      }
    },
    social: {
      facebook: String,
      twitter: String,
      linkedin: String,
      instagram: String
    },
    tools: {
      slack: {
        webhookUrl: String,
        isActive: { type: Boolean, default: false }
      },
      notion: {
        databaseId: String,
        isActive: { type: Boolean, default: false }
      }
    }
  },
  
  // Audit Trail - FIXED TO USE 'Account'
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account', // Changed from 'User' to 'Account'
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account' // Changed from 'User' to 'Account'
  },
  
  // Archive functionality
  archivedAt: {
    type: Date
  },
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account' // Changed from 'User' to 'Account'
  },
  archiveReason: {
    type: String,
    trim: true
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
businessSchema.index({ ownerId: 1, status: 1 });
businessSchema.index({ 'teamMembers.userId': 1 });
businessSchema.index({ 'teamMembers.email': 1 });
businessSchema.index({ name: 1, ownerId: 1 });
businessSchema.index({ industry: 1, businessType: 1 });
businessSchema.index({ tags: 1 });
businessSchema.index({ 'linkedProjects.projectId': 1 });
businessSchema.index({ status: 1, createdAt: -1 });

// Virtual for team member count
businessSchema.virtual('teamMemberCount').get(function() {
  return this.teamMembers ? this.teamMembers.length : 0;
});

// Virtual for active team members
businessSchema.virtual('activeTeamMembers').get(function() {
  return this.teamMembers ? this.teamMembers.filter(member => member.status === 'active') : [];
});

// Virtual for product count
businessSchema.virtual('productCount').get(function() {
  return this.products ? this.products.length : 0;
});

// Virtual for active products
businessSchema.virtual('activeProducts').get(function() {
  return this.products ? this.products.filter(product => product.status === 'active') : [];
});

// Virtual for linked project count
businessSchema.virtual('linkedProjectCount').get(function() {
  return this.linkedProjects ? this.linkedProjects.length : 0;
});

// Virtual for primary website URL
businessSchema.virtual('primaryWebsite').get(function() {
  if (this.urls && this.urls.length > 0) {
    const website = this.urls.find(url => url.type === 'website' && url.isActive);
    return website ? website.url : null;
  }
  return this.contact?.website || null;
});

// Pre-save middleware
businessSchema.pre('save', async function(next) {
  // Set lastUpdatedBy if it's an update
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  
  // Ensure owner is in team members
  if (this.isNew || this.isModified('ownerId')) {
    const ownerInTeam = this.teamMembers.find(member => 
      member.userId && member.userId.toString() === this.ownerId.toString()
    );
    
    if (!ownerInTeam) {
      try {
        // Fetch owner's email from Account model
        const Account = this.constructor.db.model('Account');
        const owner = await Account.findById(this.ownerId).select('email');
        
        if (owner && owner.email) {
          this.teamMembers.push({
            userId: this.ownerId,
            email: owner.email.toLowerCase(),
            role: 'owner',
            status: 'active',
            joinedAt: new Date(),
            invitedBy: this.ownerId,
            permissions: [
              'view_business', 'edit_business', 'delete_business',
              'manage_products', 'view_products',
              'manage_projects', 'view_projects',
              'manage_team', 'invite_users',
              'view_analytics', 'manage_integrations'
            ]
          });
        } else {
          // If we can't find the owner's email, don't add them to team members
          // The business creation will still work, but owner won't be in team members
          console.warn(`Could not find email for owner ${this.ownerId}`);
        }
      } catch (error) {
        console.error('Error fetching owner email in pre-save middleware:', error);
        // Continue without adding owner to team members if there's an error
      }
    }
  }
  
  next();
});

// Static methods
businessSchema.statics.findByOwner = function(ownerId) {
  return this.find({ 
    ownerId, 
    status: { $ne: 'closed' },
    archivedAt: { $exists: false }
  }).sort({ updatedAt: -1 });
};

businessSchema.statics.findByTeamMember = function(userId) {
  return this.find({ 
    'teamMembers.userId': userId,
    'teamMembers.status': 'active',
    status: { $ne: 'closed' },
    archivedAt: { $exists: false }
  }).sort({ updatedAt: -1 });
};

// Instance methods
businessSchema.methods.addTeamMember = function(memberData) {
  this.teamMembers.push(memberData);
  return this.save();
};

businessSchema.methods.removeTeamMember = function(userId) {
  this.teamMembers = this.teamMembers.filter(
    member => member.userId?.toString() !== userId.toString()
  );
  return this.save();
};

businessSchema.methods.updateTeamMemberRole = function(userId, newRole, permissions = []) {
  const member = this.teamMembers.find(
    member => member.userId?.toString() === userId.toString()
  );
  
  if (member) {
    member.role = newRole;
    member.permissions = permissions;
    return this.save();
  }
  
  throw new Error('Team member not found');
};

businessSchema.methods.linkProject = function(projectId, role = 'related', linkedBy) {
  // Check if project is already linked
  const existingLink = this.linkedProjects.find(
    link => link.projectId.toString() === projectId.toString()
  );
  
  if (!existingLink) {
    this.linkedProjects.push({
      projectId,
      role,
      linkedBy,
      linkedAt: new Date()
    });
  }
  
  return this.save();
};

businessSchema.methods.unlinkProject = function(projectId) {
  this.linkedProjects = this.linkedProjects.filter(
    link => link.projectId.toString() !== projectId.toString()
  );
  return this.save();
};

const Business = mongoose.model('Business', businessSchema);

module.exports = Business;