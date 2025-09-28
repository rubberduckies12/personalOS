const express = require('express');
const router = express.Router();
const Project = require('../models/projectsModel');
const Task = require('../models/tasksModel');
const Goal = require('../models/goalsModel');
const Business = require('../models/businessModel');
const { authenticateUser } = require('../middleware/auth');

// Helper function to calculate project progress based on milestones
const calculateProjectProgress = (milestones) => {
  if (!milestones || milestones.length === 0) return 0;
  
  const completedMilestones = milestones.filter(milestone => milestone.completed).length;
  return Math.round((completedMilestones / milestones.length) * 100);
};

// Helper function to determine project status based on progress and dates
const determineProjectStatus = (project, progress) => {
  if (project.status === 'completed' || project.status === 'cancelled') {
    return project.status;
  }
  
  if (progress >= 100) return 'completed';
  
  if (project.targetCompletionDate) {
    const now = new Date();
    const endDate = new Date(project.targetCompletionDate);
    const daysUntilDeadline = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDeadline < 0 && progress < 100) return 'overdue';
    if (daysUntilDeadline <= 7 && progress < 75) return 'at_risk';
  }
  
  if (progress > 0) return 'active';
  if (project.startDate && new Date(project.startDate) <= new Date()) return 'active';
  return project.status || 'planning';
};

// Helper function to get project statistics (Enhanced for team projects)
const getProjectStats = async (userId) => {
  try {
    // Get both owned and team projects
    const projects = await Project.findAccessibleToUser ? 
      await Project.findAccessibleToUser(userId) :
      await Project.find({ userId });
    
    const stats = {
      totalProjects: projects.length,
      planningProjects: projects.filter(p => p.status === 'planning').length,
      activeProjects: projects.filter(p => p.status === 'active').length,
      onHoldProjects: projects.filter(p => p.status === 'on_hold').length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      cancelledProjects: projects.filter(p => p.status === 'cancelled').length,
      overdueProjects: projects.filter(p => {
        if (!p.targetCompletionDate) return false;
        return new Date(p.targetCompletionDate) < new Date() && p.status !== 'completed';
      }).length
    };

    // Calculate average completion
    if (projects.length > 0) {
      const totalProgress = projects.reduce((sum, project) => {
        return sum + calculateProjectProgress(project.milestones);
      }, 0);
      stats.avgCompletion = Math.round(totalProgress / projects.length);
    } else {
      stats.avgCompletion = 0;
    }

    // Calculate category distribution
    const categoryCount = {};
    projects.forEach(project => {
      const category = project.category || 'other';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });

    // Convert to array and sort by count
    const categories = Object.entries(categoryCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    stats.categories = categories;

    return stats;
  } catch (error) {
    console.error('Error getting project stats:', error);
    return {
      totalProjects: 0,
      planningProjects: 0,
      activeProjects: 0,
      onHoldProjects: 0,
      completedProjects: 0,
      cancelledProjects: 0,
      overdueProjects: 0,
      avgCompletion: 0,
      categories: []
    };
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
      limit = 50
    } = req.query;

    console.log('📊 Fetching projects for user:', req.userId);

    // Build filter object
    const filter = { userId: req.userId };
    
    if (status && status !== 'all') filter.status = status;
    if (category && category !== 'all') filter.category = category;
    if (priority && priority !== 'all') filter.priority = priority;
    
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

    console.log(`📊 Found ${projects.length} projects`);

    // Calculate progress and enhance each project
    const enhancedProjects = projects.map(project => {
      const progress = calculateProjectProgress(project.milestones);
      const calculatedStatus = determineProjectStatus(project, progress);
      
      // Calculate time metrics
      const now = new Date();
      let timeMetrics = {};
      
      if (project.startDate) {
        const startDate = new Date(project.startDate);
        timeMetrics.daysActive = startDate <= now ? 
          Math.ceil((now - startDate) / (1000 * 60 * 60 * 24)) : 0;
      }
      
      if (project.targetCompletionDate) {
        const endDate = new Date(project.targetCompletionDate);
        timeMetrics.daysUntilDeadline = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      }
      
      return {
        ...project,
        progress,
        calculatedStatus,
        timeMetrics,
        isOverdue: project.targetCompletionDate && 
                   new Date(project.targetCompletionDate) < now && 
                   progress < 100
      };
    });

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
    console.error('❌ Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/projects/:id - Get specific project with details
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📊 Fetching project details for:', id);
    
    const project = await Project.findOne({ _id: id, userId: req.userId }).lean();
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Calculate progress
    const progress = calculateProjectProgress(project.milestones);
    const calculatedStatus = determineProjectStatus(project, progress);

    // Calculate detailed metrics
    const now = new Date();
    const createdDate = new Date(project.createdAt);
    const daysActive = Math.ceil((now - createdDate) / (1000 * 60 * 60 * 24));
    
    let timeMetrics = {
      daysActive,
      daysUntilDeadline: null,
      progressRate: daysActive > 0 ? progress / daysActive : 0,
      estimatedCompletion: null,
      isOnTrack: true
    };

    if (project.targetCompletionDate) {
      const endDate = new Date(project.targetCompletionDate);
      timeMetrics.daysUntilDeadline = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      
      if (timeMetrics.progressRate > 0) {
        const remainingProgress = 100 - progress;
        const estimatedDays = remainingProgress / timeMetrics.progressRate;
        timeMetrics.estimatedCompletion = new Date(now.getTime() + (estimatedDays * 24 * 60 * 60 * 1000));
        timeMetrics.isOnTrack = timeMetrics.estimatedCompletion <= endDate;
      }
    }

    // Milestone breakdown
    const milestoneStats = {
      total: project.milestones?.length || 0,
      completed: project.milestones?.filter(m => m.completed).length || 0,
      pending: project.milestones?.filter(m => !m.completed).length || 0,
      overdue: project.milestones?.filter(m => {
        return m.dueDate && new Date(m.dueDate) < now && !m.completed;
      }).length || 0
    };

    console.log('✅ Project details fetched successfully');

    res.json({
      ...project,
      progress,
      calculatedStatus,
      timeMetrics,
      milestoneStats,
      isOverdue: project.targetCompletionDate && 
                 new Date(project.targetCompletionDate) < now && 
                 progress < 100
    });

  } catch (error) {
    console.error('❌ Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /api/projects - Create new project
router.post('/', authenticateUser, async (req, res) => {
  try {
    const {
      title,
      description,
      category = 'personal',
      priority = 'medium',
      status = 'planning',
      startDate,
      targetCompletionDate,
      estimatedTotalHours,
      budget,
      tags = [],
      milestones = []
    } = req.body;

    console.log('📊 Creating new project for user:', req.userId);

    // Validation
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Project title is required' });
    }

    if (!description || description.trim().length === 0) {
      return res.status(400).json({ error: 'Project description is required' });
    }

    if (startDate && targetCompletionDate && new Date(startDate) >= new Date(targetCompletionDate)) {
      return res.status(400).json({ error: 'Target completion date must be after start date' });
    }

    // Process milestones
    const processedMilestones = milestones.map((milestone, index) => ({
      title: milestone.title,
      description: milestone.description || '',
      completed: false,
      order: milestone.order || index + 1,
      estimatedHours: milestone.estimatedHours || 0,
      actualHours: 0,
      dueDate: milestone.dueDate || null,
      dependencies: milestone.dependencies || [],
      notes: []
    }));

    // Create project
    const project = new Project({
      userId: req.userId,
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      status,
      startDate: startDate ? new Date(startDate) : null,
      targetCompletionDate: targetCompletionDate ? new Date(targetCompletionDate) : null,
      estimatedTotalHours: estimatedTotalHours || null,
      actualTotalHours: 0,
      budget: budget ? {
        estimated: budget.estimated || 0,
        actual: 0,
        currency: budget.currency || 'GBP'
      } : null,
      tags: tags.filter(tag => tag && tag.trim().length > 0).map(tag => tag.trim().toLowerCase()),
      milestones: processedMilestones,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedProject = await project.save();

    console.log('✅ Project created successfully:', savedProject._id);

    res.status(201).json({
      ...savedProject.toObject(),
      progress: calculateProjectProgress(savedProject.milestones),
      calculatedStatus: status
    });

  } catch (error) {
    console.error('❌ Error creating project:', error);
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
    
    console.log('📊 Updating project:', id);
    
    // Remove fields that shouldn't be directly updated
    delete updateData.userId;
    delete updateData.createdAt;
    updateData.updatedAt = new Date();

    // Validation
    if (updateData.title && updateData.title.trim().length === 0) {
      return res.status(400).json({ error: 'Project title cannot be empty' });
    }

    if (updateData.description && updateData.description.trim().length === 0) {
      return res.status(400).json({ error: 'Project description cannot be empty' });
    }

    if (updateData.startDate && updateData.targetCompletionDate && 
        new Date(updateData.startDate) >= new Date(updateData.targetCompletionDate)) {
      return res.status(400).json({ error: 'Target completion date must be after start date' });
    }

    // Process tags if provided
    if (updateData.tags) {
      updateData.tags = updateData.tags
        .filter(tag => tag && tag.trim().length > 0)
        .map(tag => tag.trim().toLowerCase());
    }

    // Process milestones if provided
    if (updateData.milestones) {
      updateData.milestones = updateData.milestones.map((milestone, index) => ({
        title: milestone.title,
        description: milestone.description || '',
        completed: milestone.completed || false,
        order: milestone.order || index + 1,
        estimatedHours: milestone.estimatedHours || 0,
        actualHours: milestone.actualHours || 0,
        dueDate: milestone.dueDate || null,
        dependencies: milestone.dependencies || [],
        notes: milestone.notes || [],
        completedAt: milestone.completedAt || null
      }));
    }

    const project = await Project.findOneAndUpdate(
      { _id: id, userId: req.userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    console.log('✅ Project updated successfully');

    // Calculate updated progress
    const progress = calculateProjectProgress(project.milestones);
    const calculatedStatus = determineProjectStatus(project, progress);

    res.json({
      ...project.toObject(),
      progress,
      calculatedStatus
    });

  } catch (error) {
    console.error('❌ Error updating project:', error);
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
    const { status } = req.body;

    console.log('📊 Updating project status:', id, 'to', status);

    const validStatuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status', 
        validStatuses 
      });
    }

    const updateData = {
      status,
      updatedAt: new Date()
    };

    if (status === 'completed') {
      updateData.actualCompletionDate = new Date();
    }

    const project = await Project.findOneAndUpdate(
      { _id: id, userId: req.userId },
      updateData,
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    console.log('✅ Project status updated successfully');

    const progress = calculateProjectProgress(project.milestones);

    res.json({
      ...project.toObject(),
      progress,
      message: `Project status updated to ${status}`
    });

  } catch (error) {
    console.error('❌ Error updating project status:', error);
    res.status(500).json({ error: 'Failed to update project status' });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;

    console.log('📊 Deleting project:', id);

    const project = await Project.findOneAndDelete({ _id: id, userId: req.userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    console.log('✅ Project deleted successfully');

    res.json({ 
      message: 'Project deleted successfully',
      projectTitle: project.title
    });

  } catch (error) {
    console.error('❌ Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// POST /api/projects/:id/duplicate - Duplicate project
router.post('/:id/duplicate', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { newTitle, includeActiveTasks = false } = req.body;

    console.log('📊 Duplicating project:', id);

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
      estimatedTotalHours: originalProject.estimatedTotalHours,
      budget: originalProject.budget ? {
        estimated: originalProject.budget.estimated,
        actual: 0,
        currency: originalProject.budget.currency
      } : null,
      tags: [...(originalProject.tags || [])],
      milestones: originalProject.milestones.map(milestone => ({
        ...milestone,
        completed: false,
        actualHours: 0,
        completedAt: null,
        notes: []
      })),
      status: 'planning',
      actualTotalHours: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedProject = await duplicatedProject.save();

    console.log('✅ Project duplicated successfully');

    res.status(201).json({
      ...savedProject.toObject(),
      progress: 0,
      message: 'Project duplicated successfully'
    });

  } catch (error) {
    console.error('❌ Error duplicating project:', error);
    res.status(500).json({ error: 'Failed to duplicate project' });
  }
});

// POST /api/projects/:id/link-business - Link project to business
router.post('/:id/link-business', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      businessId, 
      role = 'related', 
      priority = 'medium',
      businessPhase = 'development',
      expectedImpact = 'medium'
    } = req.body;

    console.log('🔗 Linking project to business:', id, '→', businessId);

    // Validate inputs
    if (!businessId) {
      return res.status(400).json({ error: 'Business ID is required' });
    }

    // Find the project
    const project = await Project.findOne({ _id: id, userId: req.userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user has access to the business
    const business = await Business.findOne({
      _id: businessId,
      $or: [
        { ownerId: req.userId },
        { 'teamMembers.userId': req.userId, 'teamMembers.status': 'active' }
      ]
    });

    if (!business) {
      return res.status(404).json({ error: 'Business not found or access denied' });
    }

    // Check if already linked
    const existingLink = project.linkedBusinesses.find(
      link => link.businessId.toString() === businessId
    );

    if (existingLink) {
      return res.status(400).json({ error: 'Project is already linked to this business' });
    }

    // Add link to project
    project.linkedBusinesses.push({
      businessId,
      role,
      priority,
      businessPhase,
      expectedImpact,
      linkedBy: req.userId,
      linkedAt: new Date()
    });

    await project.save();

    // Add reverse link to business
    const existingBusinessLink = business.linkedProjects.find(
      link => link.projectId.toString() === id
    );

    if (!existingBusinessLink) {
      business.linkedProjects.push({
        projectId: id,
        role,
        priority,
        businessPhase,
        expectedImpact,
        linkedBy: req.userId,
        linkedAt: new Date()
      });

      await business.save();
    }

    console.log('✅ Project linked to business successfully');

    res.json({
      message: 'Project linked to business successfully',
      link: {
        businessId,
        businessName: business.name,
        role,
        priority,
        businessPhase,
        expectedImpact
      }
    });

  } catch (error) {
    console.error('❌ Error linking project to business:', error);
    res.status(500).json({ error: 'Failed to link project to business' });
  }
});

// DELETE /api/projects/:id/unlink-business/:businessId - Unlink project from business
router.delete('/:id/unlink-business/:businessId', authenticateUser, async (req, res) => {
  try {
    const { id, businessId } = req.params;

    console.log('🔗 Unlinking project from business:', id, '→', businessId);

    // Find the project
    const project = await Project.findOne({ _id: id, userId: req.userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Remove link from project
    const linkIndex = project.linkedBusinesses.findIndex(
      link => link.businessId.toString() === businessId
    );

    if (linkIndex === -1) {
      return res.status(404).json({ error: 'Project is not linked to this business' });
    }

    project.linkedBusinesses.splice(linkIndex, 1);
    await project.save();

    // Remove reverse link from business
    const business = await Business.findById(businessId);
    if (business) {
      const businessLinkIndex = business.linkedProjects.findIndex(
        link => link.projectId.toString() === id
      );

      if (businessLinkIndex !== -1) {
        business.linkedProjects.splice(businessLinkIndex, 1);
        await business.save();
      }
    }

    console.log('✅ Project unlinked from business successfully');

    res.json({
      message: 'Project unlinked from business successfully'
    });

  } catch (error) {
    console.error('❌ Error unlinking project from business:', error);
    res.status(500).json({ error: 'Failed to unlink project from business' });
  }
});

// GET /api/projects/:id/businesses - Get businesses linked to project
router.get('/:id/businesses', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🔗 Fetching businesses for project:', id);

    const project = await Project.findOne({ _id: id, userId: req.userId })
      .populate({
        path: 'linkedBusinesses.businessId',
        select: 'name description industry status ownerId',
        populate: {
          path: 'ownerId',
          select: 'firstName lastName email'
        }
      });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const linkedBusinesses = project.linkedBusinesses.map(link => ({
      businessId: link.businessId._id,
      name: link.businessId.name,
      description: link.businessId.description,
      industry: link.businessId.industry,
      status: link.businessId.status,
      owner: link.businessId.ownerId,
      role: link.role,
      priority: link.priority,
      businessPhase: link.businessPhase,
      expectedImpact: link.expectedImpact,
      linkedAt: link.linkedAt
    }));

    res.json({
      projectId: id,
      projectTitle: project.title,
      linkedBusinesses
    });

  } catch (error) {
    console.error('❌ Error fetching project businesses:', error);
    res.status(500).json({ error: 'Failed to fetch project businesses' });
  }
});

// GET /api/projects/available-for-business/:businessId - Get projects available to link to business
router.get('/available-for-business/:businessId', authenticateUser, async (req, res) => {
  try {
    const { businessId } = req.params;
    const { search, category, status } = req.query;

    console.log('🔗 Fetching available projects for business:', businessId);

    // Check if user has access to the business
    const business = await Business.findOne({
      _id: businessId,
      $or: [
        { ownerId: req.userId },
        { 'teamMembers.userId': req.userId, 'teamMembers.status': 'active' }
      ]
    });

    if (!business) {
      return res.status(404).json({ error: 'Business not found or access denied' });
    }

    // Build filter for projects
    const filter = { userId: req.userId };
    
    if (category && category !== 'all') filter.category = category;
    if (status && status !== 'all') filter.status = status;
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Get all user's projects
    const projects = await Project.find(filter)
      .select('title description category status priority createdAt linkedBusinesses')
      .sort({ updatedAt: -1 })
      .lean();

    // Filter out already linked projects
    const availableProjects = projects.filter(project => {
      return !project.linkedBusinesses.some(
        link => link.businessId.toString() === businessId
      );
    });

    res.json({
      businessId,
      businessName: business.name,
      availableProjects: availableProjects.map(project => ({
        _id: project._id,
        title: project.title,
        description: project.description,
        category: project.category,
        status: project.status,
        priority: project.priority,
        createdAt: project.createdAt,
        linkedBusinessCount: project.linkedBusinesses?.length || 0
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching available projects:', error);
    res.status(500).json({ error: 'Failed to fetch available projects' });
  }
});

// GET /api/projects/stats/dashboard - Get dashboard statistics (Enhanced for team projects)
router.get('/stats/dashboard', authenticateUser, async (req, res) => {
  try {
    console.log('📊 Fetching dashboard stats for user:', req.userId);

    const stats = await getProjectStats(req.userId);
    
    // Get recent projects (including team projects) with safe method call
    let recentProjects = [];
    try {
      if (Project.findAccessibleToUser) {
        recentProjects = await Project.findAccessibleToUser(req.userId)
          .sort({ updatedAt: -1 })
          .limit(5)
          .populate('userId', 'firstName lastName')
          .lean();
      } else {
        // Fallback to original query
        recentProjects = await Project.find({ userId: req.userId })
          .sort({ updatedAt: -1 })
          .limit(5)
          .populate('userId', 'firstName lastName')
          .lean();
      }
    } catch (error) {
      console.warn('Error fetching recent projects:', error.message);
      recentProjects = [];
    }

    // Get upcoming deadlines
    const now = new Date();
    const upcomingDeadlines = await Project.find({
      $or: [
        { userId: req.userId },
        { 
          'teamMembers.userId': req.userId,
          'teamMembers.status': 'active'
        }
      ],
      targetCompletionDate: { $gte: now },
      status: { $in: ['planning', 'active'] },
      archived: { $ne: true }
    })
    .sort({ targetCompletionDate: 1 })
    .limit(5)
    .lean();

    // Get overdue projects
    const overdueProjects = await Project.find({
      $or: [
        { userId: req.userId },
        { 
          'teamMembers.userId': req.userId,
          'teamMembers.status': 'active'
        }
      ],
      targetCompletionDate: { $lt: now },
      status: { $nin: ['completed', 'cancelled'] },
      archived: { $ne: true }
    })
    .sort({ targetCompletionDate: 1 })
    .lean();

    // Enhanced response with categories included
    res.json({
      overview: {
        totalProjects: stats.totalProjects,
        planningProjects: stats.planningProjects,
        activeProjects: stats.activeProjects,
        onHoldProjects: stats.onHoldProjects,
        completedProjects: stats.completedProjects,
        cancelledProjects: stats.cancelledProjects,
        overdueProjects: stats.overdueProjects,
        avgCompletion: stats.avgCompletion
      },
      categories: stats.categories || [], // Add categories to the response
      recentProjects: recentProjects.map(p => ({
        id: p._id,
        title: p.title,
        status: p.status,
        updatedAt: p.updatedAt,
        progress: calculateProjectProgress(p.milestones),
        isOwner: p.userId.toString() === req.userId,
        owner: p.userId
      })),
      upcomingDeadlines: upcomingDeadlines.map(p => ({
        id: p._id,
        title: p.title,
        targetCompletionDate: p.targetCompletionDate,
        daysUntilDeadline: Math.ceil((new Date(p.targetCompletionDate) - now) / (1000 * 60 * 60 * 24)),
        isOwner: p.userId.toString() === req.userId
      })),
      overdueProjects: overdueProjects.map(p => ({
        id: p._id,
        title: p.title,
        targetCompletionDate: p.targetCompletionDate,
        daysOverdue: Math.ceil((now - new Date(p.targetCompletionDate)) / (1000 * 60 * 60 * 24)),
        isOwner: p.userId.toString() === req.userId
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching project dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch project statistics' });
  }
});

module.exports = router;