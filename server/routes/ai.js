const express = require('express');
const OpenAI = require('openai');
const router = express.Router();

// Import all models
const AiChatHistory = require('../models/AiChatHistoryModel');
const Goal = require('../models/goalsModel');
const Project = require('../models/projectsModel');
const Task = require('../models/tasksModel');
const Reading = require('../models/readingModel');
const Skill = require('../models/skillsModel');
const Income = require('../models/incomeModel');
const Budget = require('../models/budgetModel');
const Account = require('../models/accountModel');

// Import JWT authentication middleware instead of custom one
const { authenticateUser } = require('../middleware/auth');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Cost tracking configuration
const COST_LIMITS = {
  DAILY_LIMIT: parseFloat(process.env.DAILY_AI_COST_LIMIT) || 10.00,
  MONTHLY_LIMIT: parseFloat(process.env.MONTHLY_AI_COST_LIMIT) || 100.00,
  PER_REQUEST_LIMIT: parseFloat(process.env.PER_REQUEST_COST_LIMIT) || 1.00,
  WARNING_THRESHOLD: 0.80
};

// In-memory storage for embeddings and context (in production, use Redis/Vector DB)
const contextCache = {
  embeddings: new Map(),
  summaries: new Map(),
  entityLinks: new Map()
};

// Cost tracking
const costTracker = {
  daily: new Map(),
  monthly: new Map(),
  requests: new Map()
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getDateKeys = () => {
  const now = new Date();
  const daily = now.toISOString().split('T')[0];
  const monthly = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return { daily, monthly };
};

function calculateCost(model, inputTokens, outputTokens) {
  const pricing = {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4-1106-preview': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    'gpt-3.5-turbo-1106': { input: 0.001, output: 0.002 },
    'whisper-1': { input: 0.006, output: 0 },
    'tts-1': { input: 0.015, output: 0 },
    'text-embedding-3-small': { input: 0.00002, output: 0 }
  };

  const modelPricing = pricing[model] || pricing['gpt-4'];
  const inputCost = (inputTokens / 1000) * modelPricing.input;
  const outputCost = (outputTokens / 1000) * modelPricing.output;
  
  return Math.round((inputCost + outputCost) * 100) / 100;
}

const estimateRequestCost = (model, messageLength, maxTokens) => {
  const estimatedInputTokens = Math.ceil(messageLength / 4);
  const estimatedOutputTokens = maxTokens || 1000;
  return calculateCost(model, estimatedInputTokens, estimatedOutputTokens);
};

const updateCostTracking = (userId, actualCost, dateKeys) => {
  const { daily, monthly } = dateKeys;
  
  const currentDaily = costTracker.daily.get(`${userId}-${daily}`) || 0;
  costTracker.daily.set(`${userId}-${daily}`, currentDaily + actualCost);
  
  const currentMonthly = costTracker.monthly.get(`${userId}-${monthly}`) || 0;
  costTracker.monthly.set(`${userId}-${monthly}`, currentMonthly + actualCost);
  
  cleanupCostTracking();
};

const cleanupCostTracking = () => {
  const now = new Date();
  const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  
  for (const [key] of costTracker.daily) {
    const dateStr = key.split('-').slice(-3).join('-');
    const entryDate = new Date(dateStr);
    if (entryDate < thirtyOneDaysAgo) {
      costTracker.daily.delete(key);
    }
  }
  
  for (const [key] of costTracker.monthly) {
    const [userId, year, month] = key.split('-');
    const entryDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    if (entryDate < twelveMonthsAgo) {
      costTracker.monthly.delete(key);
    }
  }
};

// ============================================================================
// MIDDLEWARE - REMOVE CUSTOM AUTH, USE JWT
// ============================================================================

const trackCosts = async (req, res, next) => {
  const { daily, monthly } = getDateKeys();
  const userId = req.userId; // Set by JWT middleware
  
  const dailyUsage = costTracker.daily.get(`${userId}-${daily}`) || 0;
  const monthlyUsage = costTracker.monthly.get(`${userId}-${monthly}`) || 0;
  
  let estimatedCost = 0;
  if (req.body.message) {
    estimatedCost = estimateRequestCost(
      req.body.model || 'gpt-4',
      req.body.message.length,
      req.body.maxTokens
    );
  } else if (req.body.audioData) {
    estimatedCost = 0.10;
  }
  
  if (estimatedCost > COST_LIMITS.PER_REQUEST_LIMIT) {
    return res.status(429).json({
      error: 'Request cost estimate exceeds per-request limit',
      estimatedCost,
      limit: COST_LIMITS.PER_REQUEST_LIMIT
    });
  }
  
  if (dailyUsage + estimatedCost > COST_LIMITS.DAILY_LIMIT) {
    return res.status(429).json({
      error: 'Daily cost limit would be exceeded',
      currentUsage: dailyUsage,
      estimatedCost,
      dailyLimit: COST_LIMITS.DAILY_LIMIT,
      remainingBudget: COST_LIMITS.DAILY_LIMIT - dailyUsage
    });
  }
  
  if (monthlyUsage + estimatedCost > COST_LIMITS.MONTHLY_LIMIT) {
    return res.status(429).json({
      error: 'Monthly cost limit would be exceeded',
      currentUsage: monthlyUsage,
      estimatedCost,
      monthlyLimit: COST_LIMITS.MONTHLY_LIMIT,
      remainingBudget: COST_LIMITS.MONTHLY_LIMIT - monthlyUsage
    });
  }
  
  req.costTracking = {
    estimatedCost,
    dailyUsage,
    monthlyUsage,
    daily,
    monthly
  };
  
  next();
};

// ============================================================================
// CONTEXT & MEMORY FUNCTIONS (unchanged)
// ============================================================================

const generateEmbedding = async (text) => {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Embedding generation failed:', error);
    return null;
  }
};

const cosineSimilarity = (a, b) => {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
};

const selectRelevantMessages = async (sessionId, currentMessage, chatHistory, maxMessages = 10) => {
  try {
    if (!chatHistory) return [];

    const conversation = chatHistory.getConversation(sessionId);
    if (!conversation || conversation.messages.length === 0) return [];

    const currentEmbedding = await generateEmbedding(currentMessage);
    if (!currentEmbedding) {
      return conversation.messages.slice(-maxMessages);
    }

    const messageScores = [];

    for (const msg of conversation.messages) {
      const cacheKey = `${sessionId}-${msg._id}`;
      let embedding = contextCache.embeddings.get(cacheKey);
      
      if (!embedding) {
        embedding = await generateEmbedding(msg.content);
        if (embedding) {
          contextCache.embeddings.set(cacheKey, embedding);
        }
      }

      if (embedding) {
        const similarity = cosineSimilarity(currentEmbedding, embedding);
        messageScores.push({
          message: msg,
          score: similarity,
          recency: conversation.messages.indexOf(msg) / conversation.messages.length
        });
      }
    }

    messageScores.sort((a, b) => {
      const scoreA = a.score * 0.7 + a.recency * 0.3;
      const scoreB = b.score * 0.7 + b.recency * 0.3;
      return scoreB - scoreA;
    });

    const recentMessages = conversation.messages.slice(-2);
    const relevantMessages = messageScores.slice(0, maxMessages - 2).map(item => item.message);
    
    const allMessages = [...relevantMessages, ...recentMessages];
    const uniqueMessages = allMessages.filter((msg, index, self) => 
      self.findIndex(m => m._id?.toString() === msg._id?.toString()) === index
    );

    return uniqueMessages.slice(-maxMessages);
  } catch (error) {
    console.error('Error selecting relevant messages:', error);
    return conversation.messages.slice(-maxMessages);
  }
};

const storeConversationSummary = async (sessionId, messages, userId) => {
  try {
    if (messages.length < 5) return;

    const conversationText = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    
    const summaryResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Summarize this conversation focusing on key decisions, insights, and action items. Keep it concise but informative.'
        },
        {
          role: 'user',
          content: conversationText
        }
      ],
      max_tokens: 200,
      temperature: 0.3
    });

    const summary = summaryResponse.choices[0].message.content;
    const summaryKey = `${userId}-${sessionId}`;
    
    contextCache.summaries.set(summaryKey, {
      summary,
      messageCount: messages.length,
      timestamp: new Date(),
      sessionId
    });

    return summary;
  } catch (error) {
    console.error('Error storing conversation summary:', error);
    return null;
  }
};

const detectAndLinkEntities = async (message, userId) => {
  try {
    const entities = {
      books: [],
      tasks: [],
      projects: [],
      goals: [],
      skills: []
    };

    const [books, projects, goals, skills] = await Promise.all([
      Reading.getByUser(userId),
      Project.getByUser(userId),
      Goal.getByUser(userId),
      Skill.getByUser(userId)
    ]);

    const lowerMessage = message.toLowerCase();

    // Match books
    for (const book of books) {
      if (lowerMessage.includes(book.title.toLowerCase()) || 
          (book.author && lowerMessage.includes(book.author.toLowerCase()))) {
        entities.books.push({
          id: book._id,
          title: book.title,
          author: book.author,
          status: book.status,
          confidence: 0.9
        });
      }
    }

    // Match projects
    for (const project of projects) {
      if (lowerMessage.includes(project.title.toLowerCase())) {
        entities.projects.push({
          id: project._id,
          title: project.title,
          status: project.status,
          completion: project.completionPercentage,
          confidence: 0.9
        });
      }
    }

    // Match goals
    for (const goal of goals) {
      if (lowerMessage.includes(goal.title.toLowerCase())) {
        entities.goals.push({
          id: goal._id,
          title: goal.title,
          status: goal.status,
          category: goal.category,
          confidence: 0.9
        });
      }
    }

    // Match skills
    for (const skill of skills) {
      if (lowerMessage.includes(skill.name.toLowerCase())) {
        entities.skills.push({
          id: skill._id,
          name: skill.name,
          level: skill.currentLevel,
          status: skill.status,
          confidence: 0.9
        });
      }
    }

    const actionPatterns = {
      createTask: /(?:add task|create task|need to|should|todo|task:)\s*([^.!?]+)/i,
      finishReading: /(?:finish|complete|done with|finished)\s*reading\s*([^.!?]+)/i,
      startLearning: /(?:learn|study|practice|improve)\s*([^.!?]+)/i,
      setGoal: /(?:goal|want to|aim to|target)\s*([^.!?]+)/i
    };

    const suggestions = {};
    
    for (const [action, pattern] of Object.entries(actionPatterns)) {
      const match = message.match(pattern);
      if (match) {
        suggestions[action] = {
          text: match[1].trim(),
          confidence: 0.8,
          action
        };
      }
    }

    return { entities, suggestions };
  } catch (error) {
    console.error('Error detecting entities:', error);
    return { entities: {}, suggestions: {} };
  }
};

// ============================================================================
// SUMMARY FUNCTIONS (unchanged)  
// ============================================================================

const getProductivitySummary = async (userId) => {
  const [tasks, projects] = await Promise.all([
    Task.getByUser(userId),
    Project.getByUser(userId)
  ]);

  const overdueTasks = tasks.filter(t => t.isOverdue);
  const todayTasks = tasks.filter(t => {
    if (!t.deadline) return false;
    const today = new Date();
    const taskDate = new Date(t.deadline);
    return taskDate.toDateString() === today.toDateString();
  });

  return {
    tasks: {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      overdue: overdueTasks.length,
      dueToday: todayTasks.length,
      overdueList: overdueTasks.slice(0, 5).map(t => ({ title: t.title, deadline: t.deadline })),
      todayList: todayTasks.slice(0, 5).map(t => ({ title: t.title, deadline: t.deadline }))
    },
    projects: {
      total: projects.length,
      active: projects.filter(p => ['planning', 'active'].includes(p.status)).length,
      completed: projects.filter(p => p.status === 'completed').length,
      avgCompletion: projects.length > 0 ? 
        Math.round(projects.reduce((sum, p) => sum + (p.completionPercentage || 0), 0) / projects.length) : 0,
      activeProjects: projects
        .filter(p => ['planning', 'active'].includes(p.status))
        .slice(0, 3)
        .map(p => ({ title: p.title, completion: p.completionPercentage || 0, status: p.status }))
    }
  };
};

const getFinanceSummary = async (userId) => {
  const [budgets, income] = await Promise.all([
    Budget.getActiveBudgets ? Budget.getActiveBudgets(userId) : Budget.find({ userId, isActive: true }),
    Income.find({ userId }).limit(10).sort({ date: -1 })
  ]);

  const totalIncome = income.reduce((sum, inc) => sum + (inc.amount || 0), 0);
  const totalBudget = budgets.reduce((sum, budget) => sum + (budget.amount || 0), 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + (budget.spent || 0), 0);

  return {
    budgets: {
      total: budgets.length,
      totalAmount: totalBudget,
      totalSpent,
      remaining: totalBudget - totalSpent,
      overBudget: budgets.filter(b => (b.spentPercentage || 0) > 100).length,
      categories: budgets.map(b => ({
        category: b.category,
        spent: b.spent || 0,
        amount: b.amount || 0,
        percentage: b.spentPercentage || 0
      }))
    },
    income: {
      recentEntries: income.length,
      totalRecent: totalIncome,
      lastEntry: income[0] ? { amount: income[0].amount, date: income[0].date } : null
    }
  };
};

const getLearningAndDevelopmentSummary = async (userId) => {
  const [skills, readings] = await Promise.all([
    Skill.getByUser(userId),
    Reading.getByUser(userId)
  ]);

  return {
    skills: {
      total: skills.length,
      learning: skills.filter(s => ['learning', 'practicing'].includes(s.status)).length,
      mastered: skills.filter(s => s.status === 'mastered').length,
      categories: [...new Set(skills.map(s => s.category))],
      activeSkills: skills
        .filter(s => ['learning', 'practicing'].includes(s.status))
        .slice(0, 5)
        .map(s => ({ name: s.name, level: s.currentLevel, progress: s.progressPercentage || 0 }))
    },
    reading: {
      total: readings.length,
      currentlyReading: readings.filter(r => r.status === 'reading').length,
      completed: readings.filter(r => r.status === 'completed').length,
      genres: [...new Set(readings.map(r => r.genre))],
      currentBooks: readings
        .filter(r => r.status === 'reading')
        .slice(0, 3)
        .map(r => ({ title: r.title, author: r.author, progress: r.progressPercentage || 0 }))
    }
  };
};

const getGoalsSummary = async (userId) => {
  const goals = await Goal.getByUser(userId);
  
  return {
    total: goals.length,
    active: goals.filter(g => ['not_started', 'in_progress'].includes(g.status)).length,
    achieved: goals.filter(g => g.status === 'achieved').length,
    categories: [...new Set(goals.map(g => g.category))],
    activeGoals: goals
      .filter(g => ['not_started', 'in_progress'].includes(g.status))
      .slice(0, 5)
      .map(g => ({ title: g.title, category: g.category, status: g.status, deadline: g.deadline }))
  };
};

const getSmartUserSummary = async (userId, context = 'general') => {
  const summaryMap = {
    productivity: () => getProductivitySummary(userId),
    finance: () => getFinanceSummary(userId),
    learning: () => getLearningAndDevelopmentSummary(userId),
    goals: () => getGoalsSummary(userId),
    general: async () => {
      const [productivity, finance, learning, goals] = await Promise.all([
        getProductivitySummary(userId),
        getFinanceSummary(userId),
        getLearningAndDevelopmentSummary(userId),
        getGoalsSummary(userId)
      ]);
      return { productivity, finance, learning, goals };
    }
  };

  try {
    const summaryFunction = summaryMap[context] || summaryMap.general;
    return await summaryFunction();
  } catch (error) {
    console.error(`Error getting ${context} summary:`, error);
    return null;
  }
};

const analyzeMessageContext = (message) => {
  const lowerMessage = message.toLowerCase();
  
  const contextKeywords = {
    productivity: ['task', 'project', 'deadline', 'overdue', 'complete', 'todo', 'productivity', 'work'],
    finance: ['budget', 'money', 'spend', 'income', 'financial', 'cost', 'expense', 'save'],
    learning: ['skill', 'learn', 'book', 'read', 'study', 'course', 'practice', 'develop'],
    goals: ['goal', 'achieve', 'target', 'objective', 'plan', 'milestone', 'progress']
  };

  let bestMatch = 'general';
  let maxScore = 0;

  for (const [context, keywords] of Object.entries(contextKeywords)) {
    const score = keywords.reduce((count, keyword) => {
      return count + (lowerMessage.includes(keyword) ? 1 : 0);
    }, 0);
    
    if (score > maxScore) {
      maxScore = score;
      bestMatch = context;
    }
  }

  return maxScore > 0 ? bestMatch : 'general';
};

const createSmartSystemPrompt = (userSummary, userName, context, entityLinks = null) => {
  const basePrompt = `You are an AI assistant for ${userName}'s Personal Operating System.`;
  
  let entityContext = '';
  if (entityLinks && Object.keys(entityLinks.entities).length > 0) {
    entityContext = '\n\nRelevant entities mentioned:\n';
    for (const [type, entities] of Object.entries(entityLinks.entities)) {
      if (entities.length > 0) {
        entityContext += `${type}: ${entities.map(e => e.title || e.name).join(', ')}\n`;
      }
    }
  }

  const contextPrompts = {
    productivity: `Focus on productivity, task management, and project progress. Help with prioritization, time management, and completion strategies.

Current Productivity Status:
- Tasks: ${userSummary.tasks?.total || 0} total (${userSummary.tasks?.overdue || 0} overdue, ${userSummary.tasks?.dueToday || 0} due today)
- Projects: ${userSummary.projects?.total || 0} total (${userSummary.projects?.active || 0} active, avg ${userSummary.projects?.avgCompletion || 0}% complete)${entityContext}`,

    finance: `Focus on financial health, budgeting, and money management. Provide insights on spending patterns and financial goals.

Current Financial Status:
- Budgets: ${userSummary.budgets?.total || 0} active budgets
- Total Budget: $${userSummary.budgets?.totalAmount || 0}
- Total Spent: $${userSummary.budgets?.totalSpent || 0}
- Remaining: $${userSummary.budgets?.remaining || 0}${entityContext}`,

    learning: `Focus on skill development, learning progress, and educational growth. Help with learning strategies and skill advancement.

Current Learning Status:
- Skills: ${userSummary.skills?.total || 0} total (${userSummary.skills?.learning || 0} actively learning, ${userSummary.skills?.mastered || 0} mastered)
- Reading: ${userSummary.reading?.total || 0} books (${userSummary.reading?.currentlyReading || 0} currently reading)${entityContext}`,

    goals: `Focus on goal setting, achievement strategies, and long-term planning. Help with goal prioritization and progress tracking.

Current Goals Status:
- Goals: ${userSummary.total || 0} total (${userSummary.active || 0} active, ${userSummary.achieved || 0} achieved)${entityContext}`,

    general: `You have access to comprehensive personal data across productivity, finances, learning, and goals.

Overall Status:
- Tasks: ${userSummary.productivity?.tasks?.total || 0} (${userSummary.productivity?.tasks?.overdue || 0} overdue)
- Projects: ${userSummary.productivity?.projects?.total || 0} (${userSummary.productivity?.projects?.active || 0} active)
- Skills: ${userSummary.learning?.skills?.total || 0} (${userSummary.learning?.skills?.learning || 0} learning)
- Goals: ${userSummary.goals?.total || 0} (${userSummary.goals?.active || 0} active)${entityContext}`
  };

  return `${basePrompt}\n\n${contextPrompts[context] || contextPrompts.general}\n\nProvide helpful, specific, and actionable advice based on this data.`;
};

// ============================================================================
// API ROUTES - NOW USE JWT MIDDLEWARE
// ============================================================================

// POST /api/ai/chat - Enhanced chat endpoint
router.post('/chat', authenticateUser, trackCosts, async (req, res) => {
  try {
    console.log('🤖 AI Chat request for user:', req.userId);
    
    const {
      message,
      model = 'gpt-4',
      projectId,
      sessionId,
      temperature = 0.7,
      maxTokens = 1000,
      includeContext = true,
      stream = false
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const messageContext = includeContext ? analyzeMessageContext(message) : 'general';
    const entityLinks = await detectAndLinkEntities(message, req.userId);
    
    let userSummary = null;
    if (includeContext) {
      userSummary = await getSmartUserSummary(req.userId, messageContext);
    }

    let chatHistory = null;
    if (projectId) {
      chatHistory = await AiChatHistory.createOrGetProjectChat(
        req.userId,
        projectId,
        `AI Chat for Project`,
        'AI conversation linked to project'
      );
    }

    let messages = [];
    
    if (userSummary && includeContext) {
      messages.push({
        role: 'system',
        content: createSmartSystemPrompt(userSummary, req.user.getFullName(), messageContext, entityLinks)
      });
    }

    if (sessionId && chatHistory) {
      const relevantMessages = await selectRelevantMessages(sessionId, message, chatHistory, 8);
      messages.push(...relevantMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      })));
    }

    messages.push({
      role: 'user',
      content: message
    });

    const startTime = Date.now();

    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      let fullResponse = '';
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        const stream = await openai.chat.completions.create({
          model: model,
          messages: messages,
          temperature: temperature,
          max_tokens: maxTokens,
          stream: true
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          
          if (delta?.content) {
            fullResponse += delta.content;
            
            res.write(`data: ${JSON.stringify({
              type: 'content',
              content: delta.content,
              timestamp: Date.now()
            })}\n\n`);
          }
          
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens || 0;
            outputTokens = chunk.usage.completion_tokens || 0;
          }
        }

        const responseTime = Date.now() - startTime;
        const actualCost = calculateCost(model, inputTokens, outputTokens);

        updateCostTracking(req.userId, actualCost, {
          daily: req.costTracking.daily,
          monthly: req.costTracking.monthly
        });

        const newDailyUsage = req.costTracking.dailyUsage + actualCost;
        const newMonthlyUsage = req.costTracking.monthlyUsage + actualCost;
        
        const warnings = [];
        if (newDailyUsage > COST_LIMITS.DAILY_LIMIT * COST_LIMITS.WARNING_THRESHOLD) {
          warnings.push({
            type: 'daily',
            usage: newDailyUsage,
            limit: COST_LIMITS.DAILY_LIMIT,
            percentage: Math.round((newDailyUsage / COST_LIMITS.DAILY_LIMIT) * 100)
          });
        }
        
        if (newMonthlyUsage > COST_LIMITS.MONTHLY_LIMIT * COST_LIMITS.WARNING_THRESHOLD) {
          warnings.push({
            type: 'monthly',
            usage: newMonthlyUsage,
            limit: COST_LIMITS.MONTHLY_LIMIT,
            percentage: Math.round((newMonthlyUsage / COST_LIMITS.MONTHLY_LIMIT) * 100)
          });
        }

        if (sessionId && chatHistory) {
          await chatHistory.addMessage(sessionId, 'user', message, {
            tokens: { input: inputTokens, output: 0 },
            model: model,
            metadata: { temperature, maxTokens, responseTime: 0, cost: 0, context: messageContext, entityLinks }
          });

          await chatHistory.addMessage(sessionId, 'assistant', fullResponse, {
            tokens: { input: 0, output: outputTokens },
            model: model,
            metadata: { temperature, maxTokens, responseTime, cost: actualCost, context: messageContext }
          });

          const allMessages = [...messages, { role: 'assistant', content: fullResponse }];
          await storeConversationSummary(sessionId, allMessages, req.userId);
        }

        res.write(`data: ${JSON.stringify({
          type: 'metadata',
          metadata: {
            model,
            context: messageContext,
            entityLinks,
            tokens: {
              input: inputTokens,
              output: outputTokens,
              total: inputTokens + outputTokens
            },
            cost: {
              actual: actualCost,
              estimated: req.costTracking.estimatedCost,
              daily: {
                used: newDailyUsage,
                limit: COST_LIMITS.DAILY_LIMIT,
                remaining: COST_LIMITS.DAILY_LIMIT - newDailyUsage
              },
              monthly: {
                used: newMonthlyUsage,
                limit: COST_LIMITS.MONTHLY_LIMIT,
                remaining: COST_LIMITS.MONTHLY_LIMIT - newMonthlyUsage
              }
            },
            responseTime,
            sessionId,
            warnings
          }
        })}\n\n`);

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();

      } catch (error) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: 'Stream processing failed'
        })}\n\n`);
        res.end();
      }

    } else {
      const completion = await openai.chat.completions.create({
        model: model,
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens,
        stream: false
      });

      const responseTime = Date.now() - startTime;
      const response = completion.choices[0].message.content;

      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;
      const actualCost = calculateCost(model, inputTokens, outputTokens);

      updateCostTracking(req.userId, actualCost, {
        daily: req.costTracking.daily,
        monthly: req.costTracking.monthly
      });

      const newDailyUsage = req.costTracking.dailyUsage + actualCost;
      const newMonthlyUsage = req.costTracking.monthlyUsage + actualCost;
      
      const warnings = [];
      if (newDailyUsage > COST_LIMITS.DAILY_LIMIT * COST_LIMITS.WARNING_THRESHOLD) {
        warnings.push({
          type: 'daily',
          usage: newDailyUsage,
          limit: COST_LIMITS.DAILY_LIMIT,
          percentage: Math.round((newDailyUsage / COST_LIMITS.DAILY_LIMIT) * 100)
        });
      }
      
      if (newMonthlyUsage > COST_LIMITS.MONTHLY_LIMIT * COST_LIMITS.WARNING_THRESHOLD) {
        warnings.push({
          type: 'monthly',
          usage: newMonthlyUsage,
          limit: COST_LIMITS.MONTHLY_LIMIT,
          percentage: Math.round((newMonthlyUsage / COST_LIMITS.MONTHLY_LIMIT) * 100)
        });
      }

      if (sessionId && chatHistory) {
        await chatHistory.addMessage(sessionId, 'user', message, {
          tokens: { input: inputTokens, output: 0 },
          model: model,
          metadata: { temperature, maxTokens, responseTime: 0, cost: 0, context: messageContext, entityLinks }
        });

        await chatHistory.addMessage(sessionId, 'assistant', response, {
          tokens: { input: 0, output: outputTokens },
          model: model,
          metadata: { temperature, maxTokens, responseTime, cost: actualCost, context: messageContext }
        });

        const allMessages = [...messages, { role: 'assistant', content: response }];
        await storeConversationSummary(sessionId, allMessages, req.userId);
      }

      res.json({
        response,
        metadata: {
          model,
          context: messageContext,
          entityLinks,
          tokens: {
            input: inputTokens,
            output: outputTokens,
            total: inputTokens + outputTokens
          },
          cost: {
            actual: actualCost,
            estimated: req.costTracking.estimatedCost,
            daily: {
              used: newDailyUsage,
              limit: COST_LIMITS.DAILY_LIMIT,
              remaining: COST_LIMITS.DAILY_LIMIT - newDailyUsage
            },
            monthly: {
              used: newMonthlyUsage,
              limit: COST_LIMITS.MONTHLY_LIMIT,
              remaining: COST_LIMITS.MONTHLY_LIMIT - newMonthlyUsage
            }
          },
          responseTime,
          sessionId,
          warnings
        }
      });
    }

  } catch (error) {
    console.error('Chat error:', error);
    if (req.body.stream) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
      }
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'Failed to process chat request'
      })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: 'Failed to process chat request' });
    }
  }
});

// POST /api/ai/voice - Voice chat endpoint
router.post('/voice', authenticateUser, trackCosts, async (req, res) => {
  try {
    console.log('🎤 AI Voice request for user:', req.userId);
    
    const {
      audioData,
      model = 'whisper-1',
      language = 'en',
      projectId,
      sessionId,
      responseVoice = 'alloy'
    } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    const startTime = Date.now();

    const audioBuffer = Buffer.from(audioData, 'base64');
    const transcription = await openai.audio.transcriptions.create({
      file: audioBuffer,
      model: model,
      language: language
    });

    const userMessage = transcription.text;

    const whisperCost = calculateCost('whisper-1', audioBuffer.length / 60000, 0);
    let chatCost = 0;
    let ttsCost = 0;

    const chatResponse = await fetch(`${req.protocol}://${req.get('host')}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-id': req.userId
      },
      body: JSON.stringify({
        message: userMessage,
        projectId,
        sessionId,
        model: 'gpt-4',
        includeContext: true,
        stream: false
      })
    });

    const chatResult = await chatResponse.json();
    chatCost = chatResult.metadata?.cost?.actual || 0;

    const speech = await openai.audio.speech.create({
      model: 'tts-1',
      voice: responseVoice,
      input: chatResult.response
    });

    ttsCost = calculateCost('tts-1', chatResult.response.length / 1000, 0);

    const audioBuffer2 = Buffer.from(await speech.arrayBuffer());
    const responseTime = Date.now() - startTime;

    const totalCost = whisperCost + chatCost + ttsCost;
    updateCostTracking(req.userId, totalCost, {
      daily: req.costTracking.daily,
      monthly: req.costTracking.monthly
    });

    res.json({
      transcription: userMessage,
      response: chatResult.response,
      audio: audioBuffer2.toString('base64'),
      metadata: {
        ...chatResult.metadata,
        voice: {
          whisperCost,
          ttsCost,
          totalVoiceCost: whisperCost + ttsCost,
          totalRequestCost: totalCost,
          responseTime
        }
      }
    });

  } catch (error) {
    console.error('Voice chat error:', error);
    res.status(500).json({ error: 'Failed to process voice chat request' });
  }
});

// GET /api/ai/usage - Usage tracking endpoint
router.get('/usage', authenticateUser, async (req, res) => {
  try {
    console.log('📊 AI Usage stats requested for user:', req.userId);
    
    const { period = 'current' } = req.query;
    const { daily, monthly } = getDateKeys();
    const userId = req.userId;
    
    const currentDailyUsage = costTracker.daily.get(`${userId}-${daily}`) || 0;
    const currentMonthlyUsage = costTracker.monthly.get(`${userId}-${monthly}`) || 0;
    
    let historicalData = {};
    
    if (period === 'week' || period === 'month') {
      const days = period === 'week' ? 7 : 30;
      const historicalDaily = {};
      
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        const usage = costTracker.daily.get(`${userId}-${dateKey}`) || 0;
        historicalDaily[dateKey] = usage;
      }
      
      historicalData.daily = historicalDaily;
    }
    
    if (period === 'year') {
      const historicalMonthly = {};
      
      for (let i = 0; i < 12; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const usage = costTracker.monthly.get(`${userId}-${monthKey}`) || 0;
        historicalMonthly[monthKey] = usage;
      }
      
      historicalData.monthly = historicalMonthly;
    }
    
    res.json({
      current: {
        daily: {
          usage: currentDailyUsage,
          limit: COST_LIMITS.DAILY_LIMIT,
          remaining: COST_LIMITS.DAILY_LIMIT - currentDailyUsage,
          percentage: Math.round((currentDailyUsage / COST_LIMITS.DAILY_LIMIT) * 100)
        },
        monthly: {
          usage: currentMonthlyUsage,
          limit: COST_LIMITS.MONTHLY_LIMIT,
          remaining: COST_LIMITS.MONTHLY_LIMIT - currentMonthlyUsage,
          percentage: Math.round((currentMonthlyUsage / COST_LIMITS.MONTHLY_LIMIT) * 100)
        }
      },
      limits: COST_LIMITS,
      historical: historicalData,
      period
    });
    
  } catch (error) {
    console.error('Usage error:', error);
    res.status(500).json({ error: 'Failed to get usage data' });
  }
});

// GET /api/ai/summary - General summary (no context)
router.get('/summary', authenticateUser, async (req, res) => {
  try {
    console.log('📋 AI Summary requested for user:', req.userId);
    
    const context = 'general';
    const summary = await getSmartUserSummary(req.userId, context);
    
    console.log('📋 AI Summary response sent for user:', req.userId);
    
    res.json({
      success: true,
      context,
      summary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({
      error: 'Failed to generate summary',
      details: error.message
    });
  }
});

// GET /api/ai/summary/:context - Context-specific summary
router.get('/summary/:context', authenticateUser, async (req, res) => {
  try {
    const { context } = req.params;
    
    console.log(`📋 AI ${context} summary requested for user:`, req.userId);
    
    const validContexts = ['productivity', 'finance', 'learning', 'goals', 'general'];
    if (!validContexts.includes(context)) {
      return res.status(400).json({ 
        error: 'Invalid context',
        validContexts 
      });
    }
    
    const summary = await getSmartUserSummary(req.userId, context);
    
    console.log(`📋 AI ${context} summary response sent for user:`, req.userId);
    
    res.json({
      success: true,
      context,
      summary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating contextual summary:', error);
    res.status(500).json({
      error: 'Failed to generate summary',
      details: error.message
    });
  }
});

// GET /api/ai/contexts - Available summary contexts
router.get('/contexts', authenticateUser, (req, res) => {
  res.json({
    contexts: [
      {
        id: 'general',
        name: 'General Overview',
        description: 'Comprehensive view across all areas'
      },
      {
        id: 'productivity',
        name: 'Productivity Focus',
        description: 'Tasks, projects, and time management'
      },
      {
        id: 'finance',
        name: 'Financial Focus',
        description: 'Budgets, spending, and money management'
      },
      {
        id: 'learning',
        name: 'Learning & Development',
        description: 'Skills, courses, and personal growth'
      },
      {
        id: 'goals',
        name: 'Goals & Planning',
        description: 'Goal progress and achievement strategies'
      }
    ]
  });
});

// POST /api/ai/analyze - Data analysis endpoint
router.post('/analyze', authenticateUser, trackCosts, async (req, res) => {
  try {
    const { area, timeframe = 'month', specific } = req.body;

    let analysisPrompt = '';
    let data = {};

    switch (area) {
      case 'productivity':
        data = await getProductivitySummary(req.userId);
        analysisPrompt = 'Analyze productivity patterns, completion rates, and suggest improvements for task and project management.';
        break;

      case 'goals':
        data = await getGoalsSummary(req.userId);
        analysisPrompt = 'Analyze goal progress, identify roadblocks, and suggest strategies for achievement.';
        break;

      case 'learning':
        data = await getLearningAndDevelopmentSummary(req.userId);
        analysisPrompt = 'Analyze learning progress, skill development, and reading habits. Suggest learning paths.';
        break;

      case 'finance':
        data = await getFinanceSummary(req.userId);
        analysisPrompt = 'Analyze financial health, spending patterns, and budget adherence. Provide financial advice.';
        break;

      default:
        data = await getSmartUserSummary(req.userId, 'general');
        analysisPrompt = 'Provide a comprehensive analysis of overall life management and progress across all areas.';
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are an expert analyst for personal development and life management. Analyze the provided data and give specific, actionable insights.`
        },
        {
          role: 'user',
          content: `${analysisPrompt}\n\nData: ${JSON.stringify(data, null, 2)}\n\nProvide detailed analysis with specific recommendations, patterns identified, and actionable next steps.`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const actualCost = calculateCost('gpt-4', 
      completion.usage?.prompt_tokens || 0, 
      completion.usage?.completion_tokens || 0
    );

    updateCostTracking(req.userId, actualCost, {
      daily: req.costTracking.daily,
      monthly: req.costTracking.monthly
    });

    res.json({
      analysis: completion.choices[0].message.content,
      area,
      timeframe,
      dataPoints: Object.keys(data).length,
      metadata: {
        cost: actualCost,
        tokens: completion.usage
      }
    });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze data' });
  }
});

// GET /api/ai/models - Available models
router.get('/models', (req, res) => {
  res.json({
    chat: [
      { 
        id: 'gpt-4', 
        name: 'GPT-4', 
        description: 'Most capable model',
        pricing: { input: '$0.03/1K tokens', output: '$0.06/1K tokens' },
        supportsStreaming: true
      },
      { 
        id: 'gpt-4-turbo', 
        name: 'GPT-4 Turbo', 
        description: 'Faster and cheaper GPT-4',
        pricing: { input: '$0.01/1K tokens', output: '$0.03/1K tokens' },
        supportsStreaming: true
      },
      { 
        id: 'gpt-3.5-turbo', 
        name: 'GPT-3.5 Turbo', 
        description: 'Fast and efficient',
        pricing: { input: '$0.0015/1K tokens', output: '$0.002/1K tokens' },
        supportsStreaming: true
      }
    ],
    voice: [
      { 
        id: 'whisper-1', 
        name: 'Whisper', 
        description: 'Speech to text',
        pricing: { input: '$0.006/minute', output: 'Free' }
      }
    ],
    tts: [
      { id: 'alloy', name: 'Alloy', pricing: '$0.015/1K characters' },
      { id: 'echo', name: 'Echo', pricing: '$0.015/1K characters' },
      { id: 'fable', name: 'Fable', pricing: '$0.015/1K characters' },
      { id: 'onyx', name: 'Onyx', pricing: '$0.015/1K characters' },
      { id: 'nova', name: 'Nova', pricing: '$0.015/1K characters' },
      { id: 'shimmer', name: 'Shimmer', pricing: '$0.015/1K characters' }
    ],
    costLimits: COST_LIMITS,
    features: {
      streaming: true,
      contextualSummaries: true,
      smartContextDetection: true
    }
  });
});

// POST /api/ai/limits - Update cost limits
router.post('/limits', authenticateUser, async (req, res) => {
  try {
    const { dailyLimit, monthlyLimit, perRequestLimit } = req.body;
    
    if (dailyLimit !== undefined) COST_LIMITS.DAILY_LIMIT = parseFloat(dailyLimit);
    if (monthlyLimit !== undefined) COST_LIMITS.MONTHLY_LIMIT = parseFloat(monthlyLimit);
    if (perRequestLimit !== undefined) COST_LIMITS.PER_REQUEST_LIMIT = parseFloat(perRequestLimit);
    
    res.json({
      message: 'Cost limits updated successfully',
      limits: COST_LIMITS
    });
    
  } catch (error) {
    console.error('Limits update error:', error);
    res.status(500).json({ error: 'Failed to update limits' });
  }
});

// POST /api/ai/chat/new - Start new conversation
router.post('/chat/new', authenticateUser, async (req, res) => {
  try {
    const { projectId, title, description, tags = [] } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const chatHistory = await AiChatHistory.createOrGetProjectChat(
      req.userId,
      projectId,
      title || 'New AI Conversation',
      description || ''
    );

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await chatHistory.startNewConversation(sessionId, tags);

    res.json({
      sessionId,
      chatHistoryId: chatHistory._id,
      message: 'New conversation started'
    });

  } catch (error) {
    console.error('New chat error:', error);
    res.status(500).json({ error: 'Failed to start new conversation' });
  }
});

// GET /api/ai/chat/history/:projectId - Get chat history
router.get('/chat/history/:projectId', authenticateUser, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const chatHistory = await AiChatHistory.getByProject(req.userId, projectId);
    
    if (!chatHistory) {
      return res.json({ conversations: [], totalTokens: 0, totalCost: 0 });
    }

    res.json({
      chatHistory: chatHistory.toObject(),
      conversations: chatHistory.conversations,
      stats: chatHistory.getConversationStats()
    });

  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

// POST /api/ai/automation/daily-brief - Daily insights automation
router.post('/automation/daily-brief', authenticateUser, async (req, res) => {
  try {
    const summary = await getSmartUserSummary(req.userId, 'general');
    
    const briefData = {
      summary,
      timestamp: new Date().toISOString()
    };
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Generate a personalized daily brief for ${req.user.getFullName()}. Be encouraging, specific, and actionable.`
        },
        {
          role: 'user',
          content: `Create a daily brief based on:\n${JSON.stringify(briefData, null, 2)}`
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    });
    
    res.json({
      brief: completion.choices[0].message.content,
      data: briefData
    });
    
  } catch (error) {
    console.error('Daily brief error:', error);
    res.status(500).json({ error: 'Failed to generate daily brief' });
  }
});

module.exports = router;