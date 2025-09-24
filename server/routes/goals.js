const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Goal = require('../models/goalsModel');
const Task = require('../models/tasksModel');
const Project = require('../models/projectsModel');

// Use the same authentication middleware as finances
const { authenticateUser } = require('../middleware/auth');
router.use(authenticateUser);

// Helper function to calculate goal progress based on linked tasks/projects
const calculateGoalProgress = async (goalId, userId) => {
  try {
    // Find tasks and projects linked to this goal
    const [linkedTasks, linkedProjects] = await Promise.all([
      Task.find({ goalId, userId }),
      Project.find({ goalId, userId })
    ]);

    if (linkedTasks.length === 0 && linkedProjects.length === 0) {
      return 0; // No linked items, no progress
    }

    let totalItems = linkedTasks.length + linkedProjects.length;
    let completedItems = 0;

    // Count completed tasks
    completedItems += linkedTasks.filter(task => task.status === 'completed').length;

    // Count completed projects
    completedItems += linkedProjects.filter(project => project.status === 'completed').length;

    // For in-progress projects, add partial completion
    linkedProjects.forEach(project => {
      if (project.status === 'active' && project.completionPercentage) {
        completedItems += (project.completionPercentage / 100);
      }
    });

    return Math.round((completedItems / totalItems) * 100);
  } catch (error) {
    console.error('Error calculating goal progress:', error);
    return 0;
  }
};

// Helper function to determine goal status based on progress and deadline
const determineGoalStatus = (goal, progress) => {
  if (progress >= 100) return 'achieved';
  
  if (goal.deadline) {
    const now = new Date();
    const deadline = new Date(goal.deadline);
    const daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDeadline < 0) return 'overdue';
    if (daysUntilDeadline <= 7 && progress < 80) return 'at_risk';
  }
  
  if (progress > 0) return 'in_progress';
  return 'not_started';
};

// GET /api/goals/stats/dashboard - Get dashboard statistics (moved before /:id route)
router.get('/stats/dashboard', async (req, res) => {
  try {
    console.log('📊 GET /api/goals/stats/dashboard - User:', req.userId);
    
    const goals = await Goal.find({ userId: req.userId });

    // Calculate progress for all goals
    const goalsWithProgress = await Promise.all(
      goals.map(async (goal) => {
        const progress = await calculateGoalProgress(goal._id, req.userId);
        return { ...goal.toObject(), progress };
      })
    );

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const stats = {
      overview: {
        total: goals.length,
        achieved: goals.filter(g => g.status === 'achieved').length,
        inProgress: goals.filter(g => ['in_progress', 'not_started'].includes(g.status)).length,
        overdue: goalsWithProgress.filter(g => 
          g.targetDate && new Date(g.targetDate) < now && g.progress < 100
        ).length
      },
      categories: {},
      priorities: {},
      recentActivity: {
        goalsCreatedThisMonth: goals.filter(g => g.createdAt >= thisMonth).length,
        goalsAchievedThisMonth: goals.filter(g => 
          g.achievedAt && g.achievedAt >= thisMonth
        ).length
      },
      upcomingDeadlines: goalsWithProgress
        .filter(g => g.targetDate && new Date(g.targetDate) > now && g.progress < 100)
        .sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate))
        .slice(0, 5)
        .map(g => ({
          id: g._id,
          title: g.title,
          deadline: g.targetDate,
          progress: g.progress,
          daysUntilDeadline: Math.ceil((new Date(g.targetDate) - now) / (1000 * 60 * 60 * 24))
        })),
      topCategories: []
    };

    // Calculate category and priority breakdowns
    goals.forEach(goal => {
      stats.categories[goal.category] = (stats.categories[goal.category] || 0) + 1;
      stats.priorities[goal.priority] = (stats.priorities[goal.priority] || 0) + 1;
    });

    // Get top categories by goal count
    stats.topCategories = Object.entries(stats.categories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    console.log('✅ Dashboard stats calculated for user:', req.userId);
    res.json(stats);

  } catch (error) {
    console.error('❌ Error fetching goal statistics:', error);
    res.status(500).json({ error: 'Failed to fetch goal statistics' });
  }
});

// GET /api/goals/categories - Get all goal categories (moved before /:id route)
router.get('/categories', async (req, res) => {
  try {
    const categories = await Goal.distinct('category', { userId: req.userId });
    
    // Get count for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const count = await Goal.countDocuments({ userId: req.userId, category });
        return { name: category, count };
      })
    );

    res.json(categoriesWithCounts.sort((a, b) => b.count - a.count));

  } catch (error) {
    console.error('Error fetching goal categories:', error);
    res.status(500).json({ error: 'Failed to fetch goal categories' });
  }
});

// GET /api/goals/search - Search goals (moved before /:id route)
router.get('/search', async (req, res) => {
  try {
    const { q, category, status, limit = 10 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const filter = {
      userId: req.userId,
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ]
    };

    if (category) filter.category = category;
    if (status) filter.status = status;

    const goals = await Goal.find(filter)
      .limit(parseInt(limit))
      .sort({ updatedAt: -1 })
      .lean();

    // Add progress to each goal
    const goalsWithProgress = await Promise.all(
      goals.map(async (goal) => {
        const progress = await calculateGoalProgress(goal._id, req.userId);
        return { ...goal, progress };
      })
    );

    res.json({
      query: q,
      results: goalsWithProgress,
      total: goalsWithProgress.length
    });

  } catch (error) {
    console.error('Error searching goals:', error);
    res.status(500).json({ error: 'Failed to search goals' });
  }
});

// GET /api/goals - Get all goals for user
router.get('/', async (req, res) => {
  try {
    console.log('🎯 GET /api/goals - User:', req.userId);
    
    const { 
      status, 
      category, 
      priority,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 50
    } = req.query;

    // Build filter object
    const filter = { userId: req.userId };
    
    if (status && status !== 'all') {
      if (status === 'active') {
        filter.status = { $in: ['not_started', 'in_progress'] };
      } else {
        filter.status = status;
      }
    }
    if (category && category !== 'all') {
      filter.category = new RegExp(category, 'i');
    }
    if (priority && priority !== 'all') filter.priority = priority;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get goals with pagination
    const goals = await Goal.find(filter)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Calculate progress for each goal
    const goalsWithProgress = await Promise.all(
      goals.map(async (goal) => {
        const progress = await calculateGoalProgress(goal._id, req.userId);
        const status = determineGoalStatus(goal, progress);
        
        return {
          ...goal,
          progress,
          calculatedStatus: status,
          isOverdue: goal.targetDate && new Date(goal.targetDate) < new Date() && progress < 100
        };
      })
    );

    // Get total count for pagination
    const totalCount = await Goal.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    // Get summary statistics
    const allGoals = await Goal.find({ userId: req.userId });
    const stats = {
      total: allGoals.length,
      achieved: allGoals.filter(g => g.status === 'achieved').length,
      inProgress: allGoals.filter(g => ['in_progress', 'not_started'].includes(g.status)).length,
      overdue: 0, // Will be calculated with progress
      categories: [...new Set(allGoals.map(g => g.category).filter(Boolean))]
    };

    console.log(`✅ Found ${goals.length} goals for user ${req.userId}`);
    
    res.json({
      goals: goalsWithProgress,
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
    console.error('❌ Error fetching goals:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// GET /api/goals/:id - Get specific goal with details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const goal = await Goal.findOne({ _id: id, userId: req.userId }).lean();
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Get linked tasks and projects
    const [linkedTasks, linkedProjects] = await Promise.all([
      Task.find({ goalId: id, userId: req.userId }),
      Project.find({ goalId: id, userId: req.userId })
    ]);

    // Calculate progress
    const progress = await calculateGoalProgress(id, req.userId);
    const calculatedStatus = determineGoalStatus(goal, progress);

    // Calculate time-based metrics
    const now = new Date();
    const createdDate = new Date(goal.createdAt);
    const daysActive = Math.ceil((now - createdDate) / (1000 * 60 * 60 * 24));
    
    let timeMetrics = {
      daysActive,
      daysUntilDeadline: null,
      progressRate: progress / daysActive, // Progress per day
      estimatedCompletion: null
    };

    if (goal.targetDate) {
      const deadline = new Date(goal.targetDate);
      timeMetrics.daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      
      if (timeMetrics.progressRate > 0) {
        const remainingProgress = 100 - progress;
        const estimatedDays = remainingProgress / timeMetrics.progressRate;
        timeMetrics.estimatedCompletion = new Date(now.getTime() + (estimatedDays * 24 * 60 * 60 * 1000));
      }
    }

    res.json({
      ...goal,
      progress,
      calculatedStatus,
      linkedTasks: linkedTasks.map(task => ({
        id: task._id,
        title: task.title,
        status: task.status,
        deadline: task.deadline
      })),
      linkedProjects: linkedProjects.map(project => ({
        id: project._id,
        title: project.title,
        status: project.status,
        completion: project.completionPercentage
      })),
      timeMetrics,
      isOverdue: goal.targetDate && new Date(goal.targetDate) < now && progress < 100
    });

  } catch (error) {
    console.error('Error fetching goal:', error);
    res.status(500).json({ error: 'Failed to fetch goal' });
  }
});

// POST /api/goals - Create new goal
router.post('/', async (req, res) => {
  try {
    console.log('🎯 POST /api/goals - User:', req.userId);
    console.log('📝 Goal data:', req.body);
    
    const {
      title,
      description,
      category,
      priority = 'medium',
      targetDate,
      isPublic = false,
      tags = [],
      targetValue,
      currentValue = 0,
      unit,
      milestones = []
    } = req.body;

    // Validation
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Goal title is required' });
    }

    if (targetDate && new Date(targetDate) <= new Date()) {
      return res.status(400).json({ error: 'Target date must be in the future' });
    }

    // Create goal
    const goal = new Goal({
      userId: req.userId,
      title: title.trim(),
      description: description?.trim() || '',
      category: category?.trim() || 'personal',
      priority,
      targetDate: targetDate ? new Date(targetDate) : null,
      isPublic,
      tags: tags.filter(tag => tag.trim().length > 0),
      targetValue: targetValue || null,
      currentValue: currentValue || 0,
      unit: unit?.trim() || null,
      milestones: milestones.map(milestone => ({
        ...milestone,
        isCompleted: false,
        completedAt: null
      })),
      status: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedGoal = await goal.save();

    console.log('✅ Goal created successfully:', savedGoal._id);
    
    // Return goal with initial progress
    res.status(201).json({
      goal: {
        ...savedGoal.toObject(),
        progress: 0,
        calculatedStatus: 'not_started',
        linkedTasks: [],
        linkedProjects: []
      }
    });

  } catch (error) {
    console.error('❌ Error creating goal:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// PUT /api/goals/:id - Update goal
router.put('/:id', async (req, res) => {
  try {
    console.log('🎯 PUT /api/goals/:id - User:', req.userId, 'Goal:', req.params.id);
    
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData.userId; // Prevent userId modification
    updateData.updatedAt = new Date();

    // Validation
    if (updateData.targetDate && new Date(updateData.targetDate) <= new Date()) {
      return res.status(400).json({ error: 'Target date must be in the future' });
    }

    const goal = await Goal.findOneAndUpdate(
      { _id: id, userId: req.userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Calculate updated progress
    const progress = await calculateGoalProgress(id, req.userId);
    const calculatedStatus = determineGoalStatus(goal, progress);

    console.log('✅ Goal updated successfully:', goal._id);

    res.json({
      goal: {
        ...goal.toObject(),
        progress,
        calculatedStatus
      }
    });

  } catch (error) {
    console.error('❌ Error updating goal:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// PUT /api/goals/:id/progress - Update goal progress manually
router.put('/:id/progress', async (req, res) => {
  try {
    console.log('📈 PUT /api/goals/:id/progress - User:', req.userId, 'Goal:', req.params.id);
    
    const { id } = req.params;
    const { currentValue, milestoneId, isCompleted, progressPercentage, notes, progressType, milestone } = req.body;

    const goal = await Goal.findOne({ _id: id, userId: req.userId });
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    let updated = false;

    // Add progress entry
    const progressEntry = {
      progressType: progressType || 'completion',
      currentValue: currentValue,
      targetValue: goal.targetValue,
      progressPercentage: progressPercentage,
      milestone: milestone,
      notes: notes,
      date: new Date(),
      id: new Date().getTime().toString()
    };

    goal.progressEntries = goal.progressEntries || [];
    goal.progressEntries.push(progressEntry);
    updated = true;

    // Update current value if provided
    if (currentValue !== undefined) {
      goal.currentValue = currentValue;
      updated = true;
    }

    // Update milestone completion if provided
    if (milestoneId) {
      const milestone = goal.milestones.id(milestoneId);
      if (milestone) {
        milestone.isCompleted = isCompleted;
        milestone.completedAt = isCompleted ? new Date() : null;
        updated = true;
      }
    }

    if (updated) {
      goal.updatedAt = new Date();
      await goal.save();
    }

    // Calculate progress
    const progress = await calculateGoalProgress(id, req.userId);
    const calculatedStatus = determineGoalStatus(goal, progress);

    // Auto-update status if goal is achieved
    if (progress >= 100 && goal.status !== 'achieved') {
      goal.status = 'achieved';
      goal.achievedAt = new Date();
      await goal.save();
    }

    console.log('✅ Progress updated successfully');

    res.json({
      goal: {
        ...goal.toObject(),
        progress,
        calculatedStatus
      }
    });

  } catch (error) {
    console.error('❌ Error updating goal progress:', error);
    res.status(500).json({ error: 'Failed to update goal progress' });
  }
});

// GET /api/goals/:id/progress - Get progress entries for goal
router.get('/:id/progress', async (req, res) => {
  try {
    console.log('📈 GET /api/goals/:id/progress - User:', req.userId, 'Goal:', req.params.id);
    
    const goal = await Goal.findOne({ _id: req.params.id, userId: req.userId });
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    const progressEntries = goal.progressEntries || [];
    console.log(`✅ Found ${progressEntries.length} progress entries`);
    
    res.json({ progressEntries });
  } catch (error) {
    console.error('❌ Error fetching progress entries:', error);
    res.status(500).json({ error: 'Failed to fetch progress entries' });
  }
});

// POST /api/goals/:id/milestones - Add milestone to goal
router.post('/:id/milestones', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, targetDate, targetValue } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Milestone title is required' });
    }

    const goal = await Goal.findOne({ _id: id, userId: req.userId });
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const milestone = {
      title: title.trim(),
      description: description?.trim() || '',
      targetDate: targetDate ? new Date(targetDate) : null,
      targetValue: targetValue || null,
      isCompleted: false,
      createdAt: new Date()
    };

    goal.milestones.push(milestone);
    goal.updatedAt = new Date();
    await goal.save();

    res.status(201).json({
      milestone: goal.milestones[goal.milestones.length - 1],
      message: 'Milestone added successfully'
    });

  } catch (error) {
    console.error('Error adding milestone:', error);
    res.status(500).json({ error: 'Failed to add milestone' });
  }
});

// DELETE /api/goals/:id/milestones/:milestoneId - Remove milestone
router.delete('/:id/milestones/:milestoneId', async (req, res) => {
  try {
    const { id, milestoneId } = req.params;

    const goal = await Goal.findOne({ _id: id, userId: req.userId });
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    goal.milestones.id(milestoneId).remove();
    goal.updatedAt = new Date();
    await goal.save();

    res.json({ message: 'Milestone removed successfully' });

  } catch (error) {
    console.error('Error removing milestone:', error);
    res.status(500).json({ error: 'Failed to remove milestone' });
  }
});

// DELETE /api/goals/:id - Delete goal
router.delete('/:id', async (req, res) => {
  try {
    console.log('🎯 DELETE /api/goals/:id - User:', req.userId, 'Goal:', req.params.id);
    
    const { id } = req.params;

    const goal = await Goal.findOneAndDelete({ _id: id, userId: req.userId });
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Optionally unlink tasks and projects (or you might want to keep the links)
    await Promise.all([
      Task.updateMany({ goalId: id, userId: req.userId }, { $unset: { goalId: 1 } }),
      Project.updateMany({ goalId: id, userId: req.userId }, { $unset: { goalId: 1 } })
    ]);

    console.log('✅ Goal deleted successfully:', goal._id);
    res.json({ message: 'Goal deleted successfully' });

  } catch (error) {
    console.error('❌ Error deleting goal:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

// POST /api/goals/:id/link-task - Link a task to a goal
router.post('/:id/link-task', async (req, res) => {
  try {
    const { id } = req.params;
    const { taskId } = req.body;

    // Verify goal exists
    const goal = await Goal.findOne({ _id: id, userId: req.userId });
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Update task to link to goal
    const task = await Task.findOneAndUpdate(
      { _id: taskId, userId: req.userId },
      { goalId: id },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Recalculate goal progress
    const progress = await calculateGoalProgress(id, req.userId);
    
    res.json({
      message: 'Task linked to goal successfully',
      task: task.toObject(),
      goalProgress: progress
    });

  } catch (error) {
    console.error('Error linking task to goal:', error);
    res.status(500).json({ error: 'Failed to link task to goal' });
  }
});

// POST /api/goals/:id/link-project - Link a project to a goal
router.post('/:id/link-project', async (req, res) => {
  try {
    const { id } = req.params;
    const { projectId } = req.body;

    // Verify goal exists
    const goal = await Goal.findOne({ _id: id, userId: req.userId });
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Update project to link to goal
    const project = await Project.findOneAndUpdate(
      { _id: projectId, userId: req.userId },
      { goalId: id },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Recalculate goal progress
    const progress = await calculateGoalProgress(id, req.userId);
    
    res.json({
      message: 'Project linked to goal successfully',
      project: project.toObject(),
      goalProgress: progress
    });

  } catch (error) {
    console.error('Error linking project to goal:', error);
    res.status(500).json({ error: 'Failed to link project to goal' });
  }
});

// PUT /api/goals/:id/roadmap/:stepIndex - Complete roadmap step with description
router.put('/:id/roadmap/:stepIndex', authenticateUser, async (req, res) => {
  try {
    console.log('🗺️ PUT /api/goals/:id/roadmap/:stepIndex - User:', req.userId, 'Goal:', req.params.id, 'Step:', req.params.stepIndex);
    
    const { id, stepIndex } = req.params;
    const { completed, notes } = req.body;

    // Validate notes if completing step
    if (completed && (!notes || notes.trim().split(/\s+/).filter(word => word.length > 0).length < 200)) {
      return res.status(400).json({ 
        error: 'Please provide at least 200 words describing how you achieved this step.' 
      });
    }

    const goal = await Goal.findOne({ _id: id, userId: req.userId });
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const stepIdx = parseInt(stepIndex);
    if (!goal.roadmap || !goal.roadmap[stepIdx]) {
      return res.status(404).json({ error: 'Roadmap step not found' });
    }

    // Update the roadmap step
    goal.roadmap[stepIdx].completed = completed;
    goal.roadmap[stepIdx].completedAt = completed ? new Date() : null;
    
    // Add detailed completion notes
    if (completed && notes) {
      goal.roadmap[stepIdx].description = notes.trim();
    }

    // Save goal (pre-save middleware will handle progress calculation and automatic status updates)
    await goal.save();

    // Log the automatic status change for debugging
    const completedSteps = goal.roadmap.filter(step => step.completed).length;
    const totalSteps = goal.roadmap.length;
    const progressPercent = Math.round((completedSteps / totalSteps) * 100);
    
    console.log(`📊 Roadmap Progress: ${completedSteps}/${totalSteps} steps (${progressPercent}%)`);
    console.log(`🎯 Goal Status: ${goal.status}`);
    
    if (progressPercent === 100) {
      console.log('🎉 All roadmap steps completed! Goal automatically marked as achieved.');
    } else if (completedSteps === 1 && goal.status === 'in_progress') {
      console.log('🚀 First roadmap step completed! Goal automatically marked as in progress.');
    }

    console.log('✅ Roadmap step updated successfully');

    res.json({
      goal: goal.toObject(),
      message: progressPercent === 100 ? 'Congratulations! All roadmap steps completed. Goal marked as achieved!' :
               completedSteps === 1 ? 'Great start! Goal marked as in progress.' : 
               'Roadmap step completed successfully!'
    });

  } catch (error) {
    console.error('❌ Error updating roadmap step:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update roadmap step' });
  }
});

module.exports = router;