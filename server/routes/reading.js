const express = require('express');
const router = express.Router();
const Reading = require('../models/readingModel');
const Task = require('../models/tasksModel');
const Goal = require('../models/goalsModel');
const UserPreferences = require('../models/userPreferencesModel');
const {
  calculateReadingProgress,
  estimateReadingTime,
  calculateReadingVelocity,
  isOverdue,
  calculateReadingStats,
  enhanceReadingItem,
  getOptimizedGenreTrends,
  getOptimizedHeatmapData,
  getCurrentYearBreakdown
} = require('../utils/readingHelpers');

// Middleware to authenticate user and load preferences
const authenticateUser = async (req, res, next) => {
  try {
    const userId = req.headers['user-id'] || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }
    
    req.userId = userId;
    
    // Load user preferences
    try {
      req.userPreferences = await UserPreferences.getUserPreferences(userId);
    } catch (error) {
      console.warn('Could not load user preferences, using defaults:', error.message);
      req.userPreferences = { reading: { yearlyGoal: 52, defaultPageTime: 3 } };
    }
    
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// GET /api/reading - Get all reading items with performance optimization
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { 
      status, 
      genre, 
      type,
      search,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      page = 1,
      limit = req.userPreferences?.dashboard?.itemsPerPage || 20,
      year,
      author
    } = req.query;

    // Build optimized filter object
    const filter = { userId: req.userId };
    
    if (status) filter.status = status;
    if (genre) filter.genre = genre;
    if (type) filter.type = type;
    if (author) filter.author = { $regex: author, $options: 'i' };
    if (year) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59);
      filter.completedAt = { $gte: startOfYear, $lte: endOfYear };
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Use lean() for better performance and parallel queries
    const [readings, totalCount, allReadings] = await Promise.all([
      Reading.find(filter)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Reading.countDocuments(filter),
      Reading.find({ userId: req.userId }).lean() // For stats calculation
    ]);

    // Enhance readings with calculated fields using helpers
    const enhancedReadings = readings.map(reading => 
      enhanceReadingItem(reading, req.userPreferences.reading)
    );

    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const stats = calculateReadingStats(allReadings, req.userPreferences.reading);

    res.json({
      readings: enhancedReadings,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      },
      stats
    });

  } catch (error) {
    console.error('Error fetching reading items:', error);
    res.status(500).json({ error: 'Failed to fetch reading items' });
  }
});

// GET /api/reading/:id - Get specific reading item with details
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    const reading = await Reading.findOne({ _id: id, userId: req.userId }).lean();
    if (!reading) {
      return res.status(404).json({ error: 'Reading item not found' });
    }

    // Use helpers for all calculations
    const enhancedReading = enhanceReadingItem(reading, req.userPreferences.reading);
    
    // Calculate advanced analytics using helpers
    let analytics = {
      daysReading: 0,
      readingVelocity: calculateReadingVelocity(reading),
      projectedCompletionDate: null,
      readingStreak: 0,
      avgSessionLength: 0
    };

    if (reading.startedAt) {
      const now = new Date();
      const startDate = new Date(reading.startedAt);
      analytics.daysReading = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
      
      if (analytics.readingVelocity > 0 && reading.totalPages) {
        const remainingPages = reading.totalPages - reading.currentPage;
        const daysToComplete = remainingPages / analytics.readingVelocity;
        analytics.projectedCompletionDate = new Date(now.getTime() + (daysToComplete * 24 * 60 * 60 * 1000));
      }
    }

    // Get reading sessions analytics
    const sessions = reading.sessions || [];
    if (sessions.length > 0) {
      const totalSessionTime = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
      analytics.avgSessionLength = Math.round(totalSessionTime / sessions.length);
      
      // Calculate streak (consecutive days with reading)
      const today = new Date();
      let streak = 0;
      for (let i = 0; i < 30; i++) { // Check last 30 days
        const checkDate = new Date(today.getTime() - (i * 24 * 60 * 60 * 1000));
        const dayStr = checkDate.toDateString();
        const hasSession = sessions.some(session => 
          new Date(session.date).toDateString() === dayStr
        );
        if (hasSession) {
          streak++;
        } else if (i > 0) { // Don't break on first day if no session
          break;
        }
      }
      analytics.readingStreak = streak;
    }

    // Get linked tasks and goals
    const [linkedTasks, linkedGoal] = await Promise.all([
      Task.find({ 
        $or: [
          { title: { $regex: reading.title, $options: 'i' } },
          { description: { $regex: reading.title, $options: 'i' } }
        ],
        userId: req.userId 
      }).limit(5).lean(),
      reading.goalId ? Goal.findById(reading.goalId).lean() : null
    ]);

    res.json({
      ...enhancedReading,
      analytics,
      linkedTasks: linkedTasks.map(task => ({
        id: task._id,
        title: task.title,
        status: task.status,
        deadline: task.deadline
      })),
      linkedGoal: linkedGoal ? {
        id: linkedGoal._id,
        title: linkedGoal.title,
        status: linkedGoal.status
      } : null
    });

  } catch (error) {
    console.error('Error fetching reading item:', error);
    res.status(500).json({ error: 'Failed to fetch reading item' });
  }
});

// POST /api/reading - Create new reading item
router.post('/', authenticateUser, async (req, res) => {
  try {
    const {
      title,
      author,
      type = 'book',
      genre,
      description,
      totalPages,
      currentPage = 0,
      isbn,
      publisher,
      publishedDate,
      targetDate,
      goalId,
      tags = [],
      status = 'to_read',
      priority = 'medium',
      rating,
      notes,
      averagePageTime
    } = req.body;

    // Validation
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (currentPage && totalPages && currentPage > totalPages) {
      return res.status(400).json({ error: 'Current page cannot exceed total pages' });
    }

    // Verify goal exists if goalId is provided
    if (goalId) {
      const goal = await Goal.findOne({ _id: goalId, userId: req.userId });
      if (!goal) {
        return res.status(400).json({ error: 'Invalid goal ID' });
      }
    }

    // Create reading item with user's default page time or provided value
    const reading = new Reading({
      userId: req.userId,
      title: title.trim(),
      author: author?.trim() || '',
      type,
      genre: genre?.trim() || '',
      description: description?.trim() || '',
      totalPages: totalPages || null,
      currentPage: currentPage || 0,
      averagePageTime: averagePageTime || req.userPreferences.reading.defaultPageTime || 3,
      isbn: isbn?.trim() || '',
      publisher: publisher?.trim() || '',
      publishedDate: publishedDate ? new Date(publishedDate) : null,
      targetDate: targetDate ? new Date(targetDate) : null,
      goalId: goalId || null,
      tags: tags.filter(tag => tag.trim().length > 0),
      status,
      priority,
      rating: rating || null,
      notes: notes?.trim() || ''
    });

    // Set startedAt if status is reading
    if (status === 'reading' && currentPage > 0) {
      reading.startedAt = new Date();
    }

    const savedReading = await reading.save();
    
    // Return enhanced reading item using helpers
    const enhancedReading = enhanceReadingItem(savedReading.toObject(), req.userPreferences.reading);

    res.status(201).json(enhancedReading);

  } catch (error) {
    console.error('Error creating reading item:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create reading item' });
  }
});

// PUT /api/reading/:id - Update reading item
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData.userId; // Prevent userId modification
    updateData.updatedAt = new Date();

    // Validation
    if (updateData.currentPage && updateData.totalPages && 
        updateData.currentPage > updateData.totalPages) {
      return res.status(400).json({ error: 'Current page cannot exceed total pages' });
    }

    // Verify goal exists if goalId is being updated
    if (updateData.goalId) {
      const goal = await Goal.findOne({ _id: updateData.goalId, userId: req.userId });
      if (!goal) {
        return res.status(400).json({ error: 'Invalid goal ID' });
      }
    }

    const reading = await Reading.findOne({ _id: id, userId: req.userId });
    if (!reading) {
      return res.status(404).json({ error: 'Reading item not found' });
    }

    // Handle status changes
    if (updateData.status && updateData.status !== reading.status) {
      if (updateData.status === 'reading' && !reading.startedAt) {
        updateData.startedAt = new Date();
      } else if (updateData.status === 'completed') {
        updateData.completedAt = new Date();
        updateData.currentPage = reading.totalPages || reading.currentPage;
      }
    }

    // Apply updates - progress will be calculated by pre-save middleware
    Object.assign(reading, updateData);
    await reading.save();

    // Return enhanced reading item using helpers
    const enhancedReading = enhanceReadingItem(reading.toObject(), req.userPreferences.reading);

    res.json(enhancedReading);

  } catch (error) {
    console.error('Error updating reading item:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update reading item' });
  }
});

// PUT /api/reading/:id/progress - Update reading progress
router.put('/:id/progress', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPage, sessionDuration, notes } = req.body;

    const reading = await Reading.findOne({ _id: id, userId: req.userId });
    if (!reading) {
      return res.status(404).json({ error: 'Reading item not found' });
    }

    // Validation
    if (currentPage && reading.totalPages && currentPage > reading.totalPages) {
      return res.status(400).json({ error: 'Current page cannot exceed total pages' });
    }

    const previousPage = reading.currentPage;

    // Update progress
    if (currentPage !== undefined) {
      reading.currentPage = currentPage;
    }

    // Add reading session
    if (sessionDuration) {
      if (!reading.sessions) reading.sessions = [];
      reading.sessions.push({
        date: new Date(),
        duration: sessionDuration, // in minutes
        pagesRead: currentPage ? currentPage - previousPage : 0,
        notes: notes || ''
      });
    }

    // Set status to reading if not already set and progress is made
    if (reading.currentPage > 0 && reading.status === 'to_read') {
      reading.status = 'reading';
      if (!reading.startedAt) reading.startedAt = new Date();
    }

    // Mark as completed if finished
    if (reading.totalPages && reading.currentPage >= reading.totalPages && reading.status !== 'completed') {
      reading.status = 'completed';
      reading.completedAt = new Date();
    }

    reading.updatedAt = new Date();
    await reading.save();

    // Return enhanced reading item using helpers
    const enhancedReading = enhanceReadingItem(reading.toObject(), req.userPreferences.reading);

    res.json({
      ...enhancedReading,
      message: 'Reading progress updated successfully'
    });

  } catch (error) {
    console.error('Error updating reading progress:', error);
    res.status(500).json({ error: 'Failed to update reading progress' });
  }
});

// POST /api/reading/:id/session - Log reading session
router.post('/:id/session', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { duration, pagesRead, startPage, endPage, notes } = req.body;

    const reading = await Reading.findOne({ _id: id, userId: req.userId });
    if (!reading) {
      return res.status(404).json({ error: 'Reading item not found' });
    }

    if (!duration && !pagesRead) {
      return res.status(400).json({ error: 'Either duration or pages read is required' });
    }

    // Initialize sessions array if needed
    if (!reading.sessions) reading.sessions = [];

    // Calculate pages read if not provided
    let actualPagesRead = pagesRead;
    if (!actualPagesRead && startPage && endPage) {
      actualPagesRead = endPage - startPage;
    }

    // Add session
    const session = {
      date: new Date(),
      duration: duration || 0,
      pagesRead: actualPagesRead || 0,
      startPage: startPage || reading.currentPage,
      endPage: endPage || (reading.currentPage + (actualPagesRead || 0)),
      notes: notes || ''
    };

    reading.sessions.push(session);

    // Update current page if end page is provided
    if (endPage && endPage > reading.currentPage) {
      reading.currentPage = endPage;
    }

    // Update reading status
    if (reading.currentPage > 0 && reading.status === 'to_read') {
      reading.status = 'reading';
      if (!reading.startedAt) reading.startedAt = new Date();
    }

    // Check if completed
    if (reading.totalPages && reading.currentPage >= reading.totalPages && reading.status !== 'completed') {
      reading.status = 'completed';
      reading.completedAt = new Date();
    }

    reading.updatedAt = new Date();
    await reading.save();

    // Use helpers for response
    const enhancedReading = enhanceReadingItem(reading.toObject(), req.userPreferences.reading);

    res.json({
      session,
      currentProgress: enhancedReading.progress,
      currentPage: reading.currentPage,
      status: reading.status,
      estimatedTimeRemaining: enhancedReading.estimatedTimeRemaining,
      message: 'Reading session logged successfully'
    });

  } catch (error) {
    console.error('Error logging reading session:', error);
    res.status(500).json({ error: 'Failed to log reading session' });
  }
});

// DELETE /api/reading/:id - Delete reading item
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;

    const reading = await Reading.findOneAndDelete({ _id: id, userId: req.userId });
    if (!reading) {
      return res.status(404).json({ error: 'Reading item not found' });
    }

    res.json({ message: 'Reading item deleted successfully' });

  } catch (error) {
    console.error('Error deleting reading item:', error);
    res.status(500).json({ error: 'Failed to delete reading item' });
  }
});

// GET /api/reading/stats/dashboard - Optimized dashboard with user preferences
router.get('/stats/dashboard', authenticateUser, async (req, res) => {
  try {
    // Use parallel queries for better performance
    const [
      readings,
      currentlyReading,
      recentlyCompleted,
      upcomingDeadlines,
      genreTrends,
      monthlyBreakdown
    ] = await Promise.all([
      Reading.find({ userId: req.userId }).lean(),
      Reading.find({ userId: req.userId, status: 'reading' })
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean(),
      Reading.find({ userId: req.userId, status: 'completed' })
        .sort({ completedAt: -1 })
        .limit(5)
        .lean(),
      Reading.find({
        userId: req.userId,
        targetDate: { $gte: new Date() },
        status: { $in: ['to_read', 'reading'] }
      }).sort({ targetDate: 1 }).limit(5).lean(),
      getOptimizedGenreTrends(req.userId, '12months'),
      getCurrentYearBreakdown(req.userId)
    ]);

    // Use helper for stats calculation
    const stats = calculateReadingStats(readings, req.userPreferences.reading);
    const userConfig = req.userPreferences.reading;

    // Fill in missing months for complete chart data
    const completeMonthlyData = [];
    const currentYear = new Date().getFullYear();
    
    for (let month = 1; month <= 12; month++) {
      const monthData = monthlyBreakdown.find(m => m._id === month);
      completeMonthlyData.push({
        month,
        monthName: new Date(currentYear, month - 1, 1).toLocaleString('default', { month: 'short' }),
        books: monthData?.books || 0,
        articles: monthData?.articles || 0,
        audiobooks: monthData?.audiobooks || 0,
        other: monthData?.other || 0,
        totalPages: monthData?.totalPages || 0,
        avgRating: monthData?.avgRating || 0,
        totalCount: monthData?.totalCount || 0
      });
    }

    res.json({
      overview: stats,
      currentlyReading: currentlyReading.map(r => ({
        id: r._id,
        title: r.title,
        author: r.author,
        type: r.type || 'book',
        progress: calculateReadingProgress(r.currentPage, r.totalPages),
        estimatedTimeRemaining: estimateReadingTime(
          r.currentPage, 
          r.totalPages, 
          r.averagePageTime || userConfig.defaultPageTime
        )
      })),
      recentlyCompleted: recentlyCompleted.map(r => ({
        id: r._id,
        title: r.title,
        author: r.author,
        type: r.type || 'book',
        completedAt: r.completedAt,
        rating: r.rating
      })),
      upcomingDeadlines: upcomingDeadlines.map(r => ({
        id: r._id,
        title: r.title,
        targetDate: r.targetDate,
        type: r.type || 'book',
        daysUntilDeadline: Math.ceil((new Date(r.targetDate) - new Date()) / (1000 * 60 * 60 * 24))
      })),
      trends: {
        genres: genreTrends
      },
      monthlyBreakdown: completeMonthlyData,
      userPreferences: {
        yearlyGoal: userConfig.yearlyGoal,
        defaultPageTime: userConfig.defaultPageTime,
        preferredGenres: userConfig.preferredGenres || []
      }
    });

  } catch (error) {
    console.error('Error fetching reading dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch reading statistics' });
  }
});

// GET /api/reading/analytics/heatmap - Optimized heatmap
router.get('/analytics/heatmap', authenticateUser, async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    const heatmapData = await getOptimizedHeatmapData(req.userId, year);
    
    // Convert to format suitable for calendar heatmap
    const calendarData = heatmapData.map(day => ({
      date: day._id,
      value: day.totalDuration,
      pages: day.totalPages,
      sessions: day.sessionCount,
      books: day.uniqueBooks.length,
      intensity: day.intensity
    }));

    res.json({
      year: parseInt(year),
      data: calendarData,
      summary: {
        totalDays: calendarData.length,
        totalMinutes: calendarData.reduce((sum, day) => sum + day.value, 0),
        totalPages: calendarData.reduce((sum, day) => sum + day.pages, 0),
        avgMinutesPerDay: calendarData.length > 0 ? 
          Math.round(calendarData.reduce((sum, day) => sum + day.value, 0) / calendarData.length) : 0
      }
    });

  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

// PUT /api/reading/preferences - Update reading preferences
router.put('/preferences', authenticateUser, async (req, res) => {
  try {
    const {
      yearlyGoal,
      defaultPageTime,
      preferredGenres,
      reminderSettings
    } = req.body;

    const preferences = await UserPreferences.getUserPreferences(req.userId);
    
    const updates = {};
    if (yearlyGoal !== undefined) updates.yearlyGoal = yearlyGoal;
    if (defaultPageTime !== undefined) updates.defaultPageTime = defaultPageTime;
    if (preferredGenres !== undefined) updates.preferredGenres = preferredGenres;
    if (reminderSettings !== undefined) updates.reminderSettings = reminderSettings;

    await preferences.updateCategory('reading', updates);

    res.json({
      message: 'Reading preferences updated successfully',
      preferences: preferences.reading
    });

  } catch (error) {
    console.error('Error updating reading preferences:', error);
    res.status(500).json({ error: 'Failed to update reading preferences' });
  }
});

module.exports = router;