const express = require('express');
const router = express.Router();
const Project = require('../models/projectsModel');
const Task = require('../models/tasksModel');
const Goal = require('../models/goalsModel');

// Middleware to authenticate user
const authenticateUser = async (req, res, next) => {
  try {
    const userId = req.headers['user-id'] || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }
    
    req.userId = userId;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Helper function to calculate project progress based on linked tasks
const calculateProjectProgress = async (projectId, userId) => {
  try {
    const tasks = await Task.find({ projectId, userId });
    
    if (tasks.length === 0) return 0;
    
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const inProgressTasks = tasks.filter(task => task.status === 'in_progress').length;
    
    // Give partial credit for in-progress tasks
    const weightedProgress = completedTasks + (inProgressTasks * 0.5);
    return Math.round((weightedProgress / tasks.length) * 100);
  } catch (error) {
    console.error('Error calculating project progress:', error);
    return 0;
  }
};

// Helper function to determine project status based on progress and dates
const determineProjectStatus = (project, progress) => {
  if (progress >= 100) return 'completed';
  
  if (project.endDate) {
    const now = new Date();
    const endDate = new Date(project.endDate);
    const daysUntilDeadline = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDeadline < 0) return 'overdue';
    if (daysUntilDeadline <= 7 && progress < 75) return 'at_risk';
  }
  
  if (progress > 0) return 'active';
  if (project.startDate && new Date(project.startDate) <= new Date()) return 'active';
  return 'planning';
};

// Helper function to get project statistics
const getProjectStats = async (userId, projectId = null) => {
  try {
    const filter = { userId };
    if (projectId) filter._id = projectId;
    
    const projects = await Project.find(filter);
    const tasks = await Task.find({ 
      userId, 
      ...(projectId && { projectId })
    });
    
    return {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => ['planning', 'active'].includes(p.status)).length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      overdueProjects: projects.filter(p => {
        if (!p.endDate) return false;
        return new Date(p.endDate) < new Date() && p.status !== 'completed';
      }).length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      avgCompletion: projects.length > 0 ? 
        Math.round(projects.reduce((sum, p) => sum + (p.completionPercentage || 0), 0) / projects.length) : 0
    };
  } catch (error) {
    console.error('Error getting project stats:', error);
    return {};
  }
};

// GET /api/projects - Get all projects for user
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { 
      status, 
      category, 
      priority,
      search,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      page = 1,
      limit = 50,
      includeArchived = false
    } = req.query;

    // Build filter object
    const filter = { userId: req.userId };
    
    if (!includeArchived) filter.status = { $ne: 'archived' };
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get projects with pagination
    const projects = await Project.find(filter)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Calculate progress and enhance each project
    const enhancedProjects = await Promise.all(
      projects.map(async (project) => {
        const progress = await calculateProjectProgress(project._id, req.userId);
        const calculatedStatus = determineProjectStatus(project, progress);
        
        // Get task count for this project
        const taskCount = await Task.countDocuments({ 
          projectId: project._id, 
          userId: req.userId 
        });
        
        // Calculate time metrics
        const now = new Date();
        let timeMetrics = {};
        
        if (project.startDate) {
          const startDate = new Date(project.startDate);
          timeMetrics.daysActive = startDate <= now ? 
            Math.ceil((now - startDate) / (1000 * 60 * 60 * 24)) : 0;
        }
        
        if (project.endDate) {
          const endDate = new Date(project.endDate);
          timeMetrics.daysUntilDeadline = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        }
        
        return {
          ...project,
          progress,
          calculatedStatus,
          taskCount,
          timeMetrics,
          isOverdue: project.endDate && new Date(project.endDate) < now && progress < 100
        };
      })
    );

    // Get total count for pagination
    const totalCount = await Project.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    // Get summary statistics
    const stats = await getProjectStats(req.userId);

    res.json({
      projects: enhancedProjects,
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
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/projects/:id - Get specific project with details
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await Project.findOne({ _id: id, userId: req.userId }).lean();
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get linked tasks and goals
    const [tasks, linkedGoal] = await Promise.all([
      Task.find({ projectId: id, userId: req.userId }).sort({ createdAt: -1 }),
      project.goalId ? Goal.findById(project.goalId) : null
    ]);

    // Calculate progress
    const progress = await calculateProjectProgress(id, req.userId);
    const calculatedStatus = determineProjectStatus(project, progress);

    // Calculate detailed metrics
    const now = new Date();
    const createdDate = new Date(project.createdAt);
    const daysActive = Math.ceil((now - createdDate) / (1000 * 60 * 60 * 24));
    
    let timeMetrics = {
      daysActive,
      daysUntilDeadline: null,
      progressRate: progress / daysActive, // Progress per day
      estimatedCompletion: null,
      isOnTrack: true
    };

    if (project.endDate) {
      const endDate = new Date(project.endDate);
      timeMetrics.daysUntilDeadline = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      
      if (timeMetrics.progressRate > 0) {
        const remainingProgress = 100 - progress;
        const estimatedDays = remainingProgress / timeMetrics.progressRate;
        timeMetrics.estimatedCompletion = new Date(now.getTime() + (estimatedDays * 24 * 60 * 60 * 1000));
        timeMetrics.isOnTrack = timeMetrics.estimatedCompletion <= endDate;
      }
    }

    // Task breakdown
    const taskStats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      notStarted: tasks.filter(t => t.status === 'not_started').length,
      overdue: tasks.filter(t => t.deadline && new Date(t.deadline) < now && t.status !== 'completed').length,
      byPriority: {
        high: tasks.filter(t => t.priority === 'high').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        low: tasks.filter(t => t.priority === 'low').length
      }
    };

    res.json({
      ...project,
      progress,
      calculatedStatus,
      tasks: tasks.map(task => ({
        id: task._id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        deadline: task.deadline,
        isOverdue: task.deadline && new Date(task.deadline) < now && task.status !== 'completed'
      })),
      linkedGoal: linkedGoal ? {
        id: linkedGoal._id,
        title: linkedGoal.title,
        status: linkedGoal.status,
        category: linkedGoal.category
      } : null,
      timeMetrics,
      taskStats,
      isOverdue: project.endDate && new Date(project.endDate) < now && progress < 100
    });

  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /api/projects - Create new project
router.post('/', authenticateUser, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      priority = 'medium',
      startDate,
      endDate,
      goalId,
      tags = [],
      budget,
      status = 'planning'
    } = req.body;

    // Validation
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Project title is required' });
    }

    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    // Verify goal exists if goalId is provided
    if (goalId) {
      const goal = await Goal.findOne({ _id: goalId, userId: req.userId });
      if (!goal) {
        return res.status(400).json({ error: 'Invalid goal ID' });
      }
    }

    // Create project
    const project = new Project({
      userId: req.userId,
      title: title.trim(),
      description: description?.trim() || '',
      category: category?.trim() || 'general',
      priority,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      goalId: goalId || null,
      tags: tags.filter(tag => tag.trim().length > 0),
      budget: budget || null,
      status,
      completionPercentage: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedProject = await project.save();

    res.status(201).json({
      ...savedProject.toObject(),
      progress: 0,
      calculatedStatus: status,
      taskCount: 0,
      tasks: []
    });

  } catch (error) {
    console.error('Error creating project:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData.userId; // Prevent userId modification
    updateData.updatedAt = new Date();

    // Validation
    if (updateData.startDate && updateData.endDate && 
        new Date(updateData.startDate) >= new Date(updateData.endDate)) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    // Verify goal exists if goalId is being updated
    if (updateData.goalId) {
      const goal = await Goal.findOne({ _id: updateData.goalId, userId: req.userId });
      if (!goal) {
        return res.status(400).json({ error: 'Invalid goal ID' });
      }
    }

    const project = await Project.findOneAndUpdate(
      { _id: id, userId: req.userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Calculate updated progress
    const progress = await calculateProjectProgress(id, req.userId);
    const calculatedStatus = determineProjectStatus(project, progress);

    // Update completion percentage
    project.completionPercentage = progress;
    await project.save();

    res.json({
      ...project.toObject(),
      progress,
      calculatedStatus
    });

  } catch (error) {
    console.error('Error updating project:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// PUT /api/projects/:id/status - Update project status
router.put('/:id/status', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, completionNotes } = req.body;

    const validStatuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status', 
        validStatuses 
      });
    }

    const project = await Project.findOne({ _id: id, userId: req.userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    project.status = status;
    project.updatedAt = new Date();

    if (status === 'completed') {
      project.completedAt = new Date();
      project.completionPercentage = 100;
      if (completionNotes) {
        project.completionNotes = completionNotes;
      }
    } else if (status === 'cancelled') {
      project.cancelledAt = new Date();
      if (completionNotes) {
        project.cancellationReason = completionNotes;
      }
    }

    await project.save();

    res.json({
      ...project.toObject(),
      message: `Project status updated to ${status}`
    });

  } catch (error) {
    console.error('Error updating project status:', error);
    res.status(500).json({ error: 'Failed to update project status' });
  }
});

// POST /api/projects/:id/tasks - Create task for project
router.post('/:id/tasks', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority = 'medium', deadline } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    // Verify project exists
    const project = await Project.findOne({ _id: id, userId: req.userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Create task linked to project
    const task = new Task({
      userId: req.userId,
      projectId: id,
      title: title.trim(),
      description: description?.trim() || '',
      priority,
      deadline: deadline ? new Date(deadline) : null,
      status: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedTask = await task.save();

    // Update project progress
    const progress = await calculateProjectProgress(id, req.userId);
    project.completionPercentage = progress;
    project.updatedAt = new Date();
    await project.save();

    res.status(201).json({
      task: savedTask.toObject(),
      projectProgress: progress
    });

  } catch (error) {
    console.error('Error creating project task:', error);
    res.status(500).json({ error: 'Failed to create task for project' });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteAssociatedTasks = false } = req.query;

    const project = await Project.findOne({ _id: id, userId: req.userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (deleteAssociatedTasks === 'true') {
      // Delete all associated tasks
      await Task.deleteMany({ projectId: id, userId: req.userId });
    } else {
      // Unlink tasks from project
      await Task.updateMany(
        { projectId: id, userId: req.userId },
        { $unset: { projectId: 1 } }
      );
    }

    await Project.findByIdAndDelete(id);

    res.json({ 
      message: 'Project deleted successfully',
      deletedAssociatedTasks: deleteAssociatedTasks === 'true'
    });

  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// GET /api/projects/stats/dashboard - Get dashboard statistics
router.get('/stats/dashboard', authenticateUser, async (req, res) => {
  try {
    const stats = await getProjectStats(req.userId);
    
    // Get recent projects
    const recentProjects = await Project.find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    // Get upcoming deadlines
    const now = new Date();
    const upcomingDeadlines = await Project.find({
      userId: req.userId,
      endDate: { $gte: now },
      status: { $in: ['planning', 'active'] }
    })
    .sort({ endDate: 1 })
    .limit(5)
    .lean();

    // Get overdue projects
    const overdueProjects = await Project.find({
      userId: req.userId,
      endDate: { $lt: now },
      status: { $ne: 'completed' }
    })
    .sort({ endDate: 1 })
    .lean();

    // Category breakdown
    const categoryStats = await Project.aggregate([
      { $match: { userId: req.userId } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      overview: stats,
      recentProjects: recentProjects.map(p => ({
        id: p._id,
        title: p.title,
        status: p.status,
        updatedAt: p.updatedAt,
        completionPercentage: p.completionPercentage || 0
      })),
      upcomingDeadlines: upcomingDeadlines.map(p => ({
        id: p._id,
        title: p.title,
        endDate: p.endDate,
        daysUntilDeadline: Math.ceil((new Date(p.endDate) - now) / (1000 * 60 * 60 * 24))
      })),
      overdueProjects: overdueProjects.map(p => ({
        id: p._id,
        title: p.title,
        endDate: p.endDate,
        daysOverdue: Math.ceil((now - new Date(p.endDate)) / (1000 * 60 * 60 * 24))
      })),
      categories: categoryStats.map(cat => ({
        name: cat._id,
        count: cat.count
      }))
    });

  } catch (error) {
    console.error('Error fetching project dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch project statistics' });
  }
});

// GET /api/projects/categories - Get all project categories
router.get('/categories', authenticateUser, async (req, res) => {
  try {
    const categories = await Project.distinct('category', { userId: req.userId });
    
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const count = await Project.countDocuments({ userId: req.userId, category });
        return { name: category, count };
      })
    );

    res.json(categoriesWithCounts.sort((a, b) => b.count - a.count));

  } catch (error) {
    console.error('Error fetching project categories:', error);
    res.status(500).json({ error: 'Failed to fetch project categories' });
  }
});

// GET /api/projects/search - Search projects
router.get('/search', authenticateUser, async (req, res) => {
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

    const projects = await Project.find(filter)
      .limit(parseInt(limit))
      .sort({ updatedAt: -1 })
      .lean();

    // Add progress to each project
    const projectsWithProgress = await Promise.all(
      projects.map(async (project) => {
        const progress = await calculateProjectProgress(project._id, req.userId);
        return { ...project, progress };
      })
    );

    res.json({
      query: q,
      results: projectsWithProgress,
      total: projectsWithProgress.length
    });

  } catch (error) {
    console.error('Error searching projects:', error);
    res.status(500).json({ error: 'Failed to search projects' });
  }
});

// POST /api/projects/:id/duplicate - Duplicate project
router.post('/:id/duplicate', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { includeActiveTasks = false, newTitle } = req.body;

    const originalProject = await Project.findOne({ _id: id, userId: req.userId });
    if (!originalProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Create new project with duplicated data
    const duplicatedProject = new Project({
      userId: req.userId,
      title: newTitle || `${originalProject.title} (Copy)`,
      description: originalProject.description,
      category: originalProject.category,
      priority: originalProject.priority,
      goalId: originalProject.goalId,
      tags: [...originalProject.tags],
      budget: originalProject.budget,
      status: 'planning',
      completionPercentage: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedProject = await duplicatedProject.save();

    // Duplicate tasks if requested
    if (includeActiveTasks) {
      const originalTasks = await Task.find({ 
        projectId: id, 
        userId: req.userId,
        status: { $ne: 'completed' } // Only duplicate non-completed tasks
      });

      const duplicatedTasks = originalTasks.map(task => ({
        userId: req.userId,
        projectId: savedProject._id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: 'not_started',
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      if (duplicatedTasks.length > 0) {
        await Task.insertMany(duplicatedTasks);
      }
    }

    res.status(201).json({
      ...savedProject.toObject(),
      message: 'Project duplicated successfully',
      duplicatedTasksCount: includeActiveTasks ? 
        await Task.countDocuments({ projectId: savedProject._id }) : 0
    });

  } catch (error) {
    console.error('Error duplicating project:', error);
    res.status(500).json({ error: 'Failed to duplicate project' });
  }
});

module.exports = router;