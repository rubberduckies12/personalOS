const mongoose = require('mongoose');

const aiChatHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
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
    maxLength: 500
  },
  conversations: [{
    sessionId: {
      type: String,
      required: true,
      index: true
    },
    messages: [{
      role: {
        type: String,
        required: true,
        enum: ['user', 'assistant', 'system'],
        index: true
      },
      content: {
        type: String,
        required: true,
        maxLength: 10000
      },
      timestamp: {
        type: Date,
        default: Date.now,
        index: true
      },
      tokens: {
        input: {
          type: Number,
          min: 0
        },
        output: {
          type: Number,
          min: 0
        }
      },
      model: {
        type: String,
        trim: true
      },
      attachments: [{
        type: {
          type: String,
          enum: ['file', 'image', 'code', 'link'],
          required: true
        },
        name: {
          type: String,
          required: true
        },
        content: {
          type: String
        },
        url: {
          type: String
        },
        size: {
          type: Number
        }
      }],
      metadata: {
        temperature: Number,
        maxTokens: Number,
        responseTime: Number, // milliseconds
        cost: Number // estimated cost in USD
      }
    }],
    startedAt: {
      type: Date,
      default: Date.now
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'archived'],
      default: 'active'
    },
    tags: [{
      type: String,
      trim: true,
      lowercase: true
    }],
    summary: {
      type: String,
      trim: true,
      maxLength: 1000
    }
  }],
  totalTokensUsed: {
    input: {
      type: Number,
      default: 0
    },
    output: {
      type: Number,
      default: 0
    }
  },
  totalCost: {
    type: Number,
    default: 0,
    min: 0
  },
  category: {
    type: String,
    enum: [
      'development',
      'debugging',
      'planning',
      'research',
      'documentation',
      'problem-solving',
      'brainstorming',
      'code-review',
      'learning',
      'other'
    ],
    default: 'development'
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permissions: {
      type: String,
      enum: ['read', 'comment', 'edit'],
      default: 'read'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  favoriteMessages: [{
    conversationIndex: {
      type: Number,
      required: true
    },
    messageIndex: {
      type: Number,
      required: true
    },
    note: {
      type: String,
      trim: true,
      maxLength: 300
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient querying
aiChatHistorySchema.index({ userId: 1, projectId: 1 });
aiChatHistorySchema.index({ userId: 1, category: 1 });
aiChatHistorySchema.index({ userId: 1, createdAt: -1 });
aiChatHistorySchema.index({ userId: 1, isArchived: 1 });
aiChatHistorySchema.index({ 'conversations.sessionId': 1 });

// Virtual for total conversations count
aiChatHistorySchema.virtual('totalConversations').get(function() {
  return this.conversations ? this.conversations.length : 0;
});

// Virtual for total messages count
aiChatHistorySchema.virtual('totalMessages').get(function() {
  if (!this.conversations) return 0;
  return this.conversations.reduce((total, conv) => total + conv.messages.length, 0);
});

// Virtual for active conversations
aiChatHistorySchema.virtual('activeConversations').get(function() {
  if (!this.conversations) return [];
  return this.conversations.filter(conv => conv.status === 'active');
});

// Virtual for latest conversation
aiChatHistorySchema.virtual('latestConversation').get(function() {
  if (!this.conversations || this.conversations.length === 0) return null;
  return this.conversations.sort((a, b) => b.lastActivity - a.lastActivity)[0];
});

// Virtual for average tokens per message
aiChatHistorySchema.virtual('avgTokensPerMessage').get(function() {
  const totalMessages = this.totalMessages;
  if (totalMessages === 0) return 0;
  const totalTokens = this.totalTokensUsed.input + this.totalTokensUsed.output;
  return Math.round(totalTokens / totalMessages);
});

// Pre-save middleware to update totals
aiChatHistorySchema.pre('save', function(next) {
  // Calculate total tokens and cost
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;
  
  this.conversations.forEach(conv => {
    conv.messages.forEach(msg => {
      if (msg.tokens) {
        totalInputTokens += msg.tokens.input || 0;
        totalOutputTokens += msg.tokens.output || 0;
      }
      if (msg.metadata && msg.metadata.cost) {
        totalCost += msg.metadata.cost;
      }
    });
  });
  
  this.totalTokensUsed.input = totalInputTokens;
  this.totalTokensUsed.output = totalOutputTokens;
  this.totalCost = totalCost;
  
  next();
});

// Static methods
aiChatHistorySchema.statics.getByProject = function(userId, projectId) {
  return this.findOne({ userId, projectId, isArchived: false });
};

aiChatHistorySchema.statics.getByUser = function(userId, filters = {}) {
  const query = { userId, isArchived: false, ...filters };
  return this.find(query).sort({ updatedAt: -1 });
};

aiChatHistorySchema.statics.searchConversations = function(userId, searchTerm) {
  const regex = new RegExp(searchTerm, 'i');
  return this.find({
    userId,
    isArchived: false,
    $or: [
      { title: regex },
      { description: regex },
      { 'conversations.messages.content': regex },
      { 'conversations.summary': regex }
    ]
  }).sort({ updatedAt: -1 });
};

aiChatHistorySchema.statics.getByCategory = function(userId, category) {
  return this.find({ userId, category, isArchived: false }).sort({ updatedAt: -1 });
};

aiChatHistorySchema.statics.createOrGetProjectChat = function(userId, projectId, title, description = '') {
  return this.findOneAndUpdate(
    { userId, projectId },
    {
      $setOnInsert: {
        userId,
        projectId,
        title,
        description,
        conversations: [],
        totalTokensUsed: { input: 0, output: 0 },
        totalCost: 0
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

// Instance methods
aiChatHistorySchema.methods.startNewConversation = function(sessionId, tags = []) {
  const newConversation = {
    sessionId,
    messages: [],
    startedAt: new Date(),
    lastActivity: new Date(),
    status: 'active',
    tags,
    summary: ''
  };
  
  this.conversations.push(newConversation);
  return this.save();
};

aiChatHistorySchema.methods.addMessage = function(sessionId, role, content, options = {}) {
  const conversation = this.conversations.find(conv => conv.sessionId === sessionId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  const message = {
    role,
    content,
    timestamp: new Date(),
    tokens: options.tokens || {},
    model: options.model || '',
    attachments: options.attachments || [],
    metadata: options.metadata || {}
  };
  
  conversation.messages.push(message);
  conversation.lastActivity = new Date();
  
  return this.save();
};

aiChatHistorySchema.methods.getConversation = function(sessionId) {
  return this.conversations.find(conv => conv.sessionId === sessionId);
};

aiChatHistorySchema.methods.updateConversationSummary = function(sessionId, summary) {
  const conversation = this.conversations.find(conv => conv.sessionId === sessionId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  conversation.summary = summary;
  return this.save();
};

aiChatHistorySchema.methods.endConversation = function(sessionId, summary = '') {
  const conversation = this.conversations.find(conv => conv.sessionId === sessionId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  conversation.status = 'completed';
  if (summary) {
    conversation.summary = summary;
  }
  
  return this.save();
};

aiChatHistorySchema.methods.archiveConversation = function(sessionId) {
  const conversation = this.conversations.find(conv => conv.sessionId === sessionId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  conversation.status = 'archived';
  return this.save();
};

aiChatHistorySchema.methods.favoriteMessage = function(sessionId, messageIndex, note = '') {
  const conversationIndex = this.conversations.findIndex(conv => conv.sessionId === sessionId);
  if (conversationIndex === -1) {
    throw new Error('Conversation not found');
  }
  
  this.favoriteMessages.push({
    conversationIndex,
    messageIndex,
    note,
    addedAt: new Date()
  });
  
  return this.save();
};

aiChatHistorySchema.methods.exportConversation = function(sessionId, format = 'json') {
  const conversation = this.getConversation(sessionId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  if (format === 'json') {
    return JSON.stringify(conversation, null, 2);
  } else if (format === 'markdown') {
    let markdown = `# ${this.title}\n\n`;
    markdown += `**Project:** ${this.projectId}\n`;
    markdown += `**Started:** ${conversation.startedAt}\n`;
    markdown += `**Summary:** ${conversation.summary}\n\n`;
    
    conversation.messages.forEach(msg => {
      markdown += `## ${msg.role.toUpperCase()}\n`;
      markdown += `${msg.content}\n\n`;
    });
    
    return markdown;
  }
  
  throw new Error('Unsupported export format');
};

aiChatHistorySchema.methods.getConversationStats = function() {
  return {
    totalConversations: this.totalConversations,
    totalMessages: this.totalMessages,
    totalTokens: this.totalTokensUsed.input + this.totalTokensUsed.output,
    totalCost: this.totalCost,
    avgTokensPerMessage: this.avgTokensPerMessage,
    favoriteMessages: this.favoriteMessages.length
  };
};

aiChatHistorySchema.methods.mergeConversations = function(sessionIds) {
  if (sessionIds.length < 2) {
    throw new Error('Need at least 2 conversations to merge');
  }
  
  const conversationsToMerge = this.conversations.filter(conv => 
    sessionIds.includes(conv.sessionId)
  );
  
  if (conversationsToMerge.length !== sessionIds.length) {
    throw new Error('Some conversations not found');
  }
  
  // Create merged conversation
  const mergedMessages = [];
  conversationsToMerge.forEach(conv => {
    mergedMessages.push(...conv.messages);
  });
  
  // Sort by timestamp
  mergedMessages.sort((a, b) => a.timestamp - b.timestamp);
  
  const mergedConversation = {
    sessionId: `merged_${Date.now()}`,
    messages: mergedMessages,
    startedAt: Math.min(...conversationsToMerge.map(c => c.startedAt)),
    lastActivity: new Date(),
    status: 'active',
    tags: [...new Set(conversationsToMerge.flatMap(c => c.tags))],
    summary: `Merged conversation from ${sessionIds.length} sessions`
  };
  
  // Remove original conversations and add merged one
  this.conversations = this.conversations.filter(conv => 
    !sessionIds.includes(conv.sessionId)
  );
  this.conversations.push(mergedConversation);
  
  return this.save();
};

const AiChatHistory = mongoose.model('AiChatHistory', aiChatHistorySchema);

module.exports = AiChatHistory;