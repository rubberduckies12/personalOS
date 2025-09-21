const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Skill = require('../models/skillsModel');

// Middleware to verify user authentication
const authenticateUser = async (req, res, next) => {
  try {
    // This should integrate with your existing authentication middleware
    // For now, assuming user ID is passed in headers or extracted from JWT
    const userId = req.headers['user-id'] || req.user?.id;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    req.userId = userId;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

// Apply authentication middleware to all routes
router.use(authenticateUser);

// GET /api/skills - Get all skills for user
router.get('/', async (req, res) => {
  try {
    const {
      category,
      status = 'not_started,learning,practicing,maintaining',
      priority,
      level,
      sort = 'updatedAt',
      order = 'desc',
      search,
      page = 1,
      limit = 20,
      archived = false
    } = req.query;

    // Build filter
    const filter = { userId: req.userId, archived: archived === 'true' };
    
    if (category && category !== 'all') {
      filter.category = category;
    }
    
    if (status && status !== 'all') {
      const statusArray = status.split(',');
      filter.status = { $in: statusArray };
    }
    
    if (priority && priority !== 'all') {
      filter.priority = priority;
    }
    
    if (level && level !== 'all') {
      filter.currentLevel = level;
    }
    
    if (search) {
      const searchResults = await Skill.searchSkills(req.userId, search);
      return res.json({
        skills: searchResults.slice((parseInt(page) - 1) * parseInt(limit), parseInt(page) * parseInt(limit)),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(searchResults.length / parseInt(limit)),
          totalItems: searchResults.length,
          itemsPerPage: parseInt(limit)
        }
      });
    }

    // Build sort
    const sortObj = {};
    sortObj[sort] = order === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [skills, total] = await Promise.all([
      Skill.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Skill.countDocuments(filter)
    ]);

    // Add computed fields
    const enrichedSkills = skills.map(skill => ({
      ...skill,
      progressPercentage: calculateProgressPercentage(skill),
      totalPracticeTime: skill.practiceLog?.reduce((total, log) => total + (log.duration || 0), 0) || 0,
      avgPracticeEffectiveness: calculateAvgEffectiveness(skill.practiceLog),
      nextPhase: getNextPhase(skill.learningPlan?.phases),
      recentPractice: skill.practiceLog?.slice(-5) || []
    }));

    res.json({
      skills: enrichedSkills,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrev: parseInt(page) > 1
      },
      summary: {
        totalSkills: total,
        activeSkills: await Skill.countDocuments({ userId: req.userId, status: { $in: ['learning', 'practicing'] }, archived: false }),
        masteredSkills: await Skill.countDocuments({ userId: req.userId, status: 'mastered', archived: false })
      }
    });

  } catch (error) {
    console.error('Error fetching skills:', error);
    res.status(500).json({
      error: 'Failed to fetch skills',
      code: 'FETCH_ERROR'
    });
  }
});

// GET /api/skills/:id - Get specific skill
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid skill ID',
        code: 'INVALID_ID'
      });
    }

    const skill = await Skill.findOne({
      _id: id,
      userId: req.userId
    })
    .populate('linkedResources.projects.projectId', 'title status')
    .populate('linkedResources.books.readingId', 'title author status')
    .populate('linkedResources.goals.goalId', 'title status progress')
    .populate('linkedResources.businesses.businessId', 'name')
    .lean();

    if (!skill) {
      return res.status(404).json({
        error: 'Skill not found',
        code: 'SKILL_NOT_FOUND'
      });
    }

    // Add computed analytics
    const skillWithAnalytics = {
      ...skill,
      analytics: {
        progressPercentage: calculateProgressPercentage(skill),
        totalPracticeTime: skill.practiceLog?.reduce((total, log) => total + (log.duration || 0), 0) || 0,
        avgPracticeEffectiveness: calculateAvgEffectiveness(skill.practiceLog),
        practiceStreak: calculatePracticeStreak(skill.practiceLog),
        weeklyPracticeTime: getWeeklyPracticeTime(skill.practiceLog),
        recentAssessments: skill.assessments?.slice(-3) || [],
        completedMilestones: skill.progressTracking?.milestones?.filter(m => m.completed).length || 0,
        totalMilestones: skill.progressTracking?.milestones?.length || 0,
        nextMilestone: skill.progressTracking?.milestones?.find(m => !m.completed) || null,
        learningPhaseProgress: calculatePhaseProgress(skill.learningPlan?.phases)
      }
    };

    res.json(skillWithAnalytics);

  } catch (error) {
    console.error('Error fetching skill:', error);
    res.status(500).json({
      error: 'Failed to fetch skill',
      code: 'FETCH_ERROR'
    });
  }
});

// POST /api/skills - Create new skill
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      subcategory,
      currentLevel = 'beginner',
      targetLevel,
      priority = 'medium',
      progressTracking = { type: 'percentage', currentValue: 0 },
      tags = []
    } = req.body;

    // Validation
    const validationErrors = [];

    if (!name || name.trim().length < 2) {
      validationErrors.push('Skill name must be at least 2 characters long');
    }

    if (!category) {
      validationErrors.push('Category is required');
    }

    if (!targetLevel) {
      validationErrors.push('Target level is required');
    }

    // Validate level progression
    const levels = ['beginner', 'novice', 'intermediate', 'advanced', 'expert', 'master'];
    const currentLevelIndex = levels.indexOf(currentLevel);
    const targetLevelIndex = levels.indexOf(targetLevel);

    if (targetLevelIndex <= currentLevelIndex) {
      validationErrors.push('Target level must be higher than current level');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }

    // Check for duplicate skill name for this user
    const existingSkill = await Skill.findOne({
      userId: req.userId,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      archived: false
    });

    if (existingSkill) {
      return res.status(409).json({
        error: 'A skill with this name already exists',
        code: 'DUPLICATE_SKILL'
      });
    }

    // Create skill
    const skill = new Skill({
      userId: req.userId,
      name: name.trim(),
      description: description?.trim(),
      category,
      subcategory: subcategory?.trim(),
      currentLevel,
      targetLevel,
      priority,
      progressTracking,
      tags: tags.map(tag => tag.trim()).filter(tag => tag.length > 0),
      status: 'not_started',
      linkedResources: {
        projects: [],
        books: [],
        goals: [],
        businesses: [],
        courses: []
      },
      learningPlan: {
        phases: [],
        totalEstimatedTime: 0
      },
      assessments: [],
      practiceLog: []
    });

    await skill.save();

    res.status(201).json({
      message: 'Skill created successfully',
      code: 'SKILL_CREATED',
      skill: skill.toObject()
    });

    console.log(`New skill created: ${skill.name} for user ${req.userId}`);

  } catch (error) {
    console.error('Error creating skill:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }

    res.status(500).json({
      error: 'Failed to create skill',
      code: 'CREATE_ERROR'
    });
  }
});

// PUT /api/skills/:id - Update skill
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid skill ID',
        code: 'INVALID_ID'
      });
    }

    const skill = await Skill.findOne({
      _id: id,
      userId: req.userId
    });

    if (!skill) {
      return res.status(404).json({
        error: 'Skill not found',
        code: 'SKILL_NOT_FOUND'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'name', 'description', 'category', 'subcategory', 'currentLevel', 
      'targetLevel', 'priority', 'status', 'progressTracking', 'tags', 'isPublic'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Validate level progression if levels are being updated
    if (updates.currentLevel || updates.targetLevel) {
      const levels = ['beginner', 'novice', 'intermediate', 'advanced', 'expert', 'master'];
      const currentLevel = updates.currentLevel || skill.currentLevel;
      const targetLevel = updates.targetLevel || skill.targetLevel;
      
      const currentLevelIndex = levels.indexOf(currentLevel);
      const targetLevelIndex = levels.indexOf(targetLevel);

      if (targetLevelIndex <= currentLevelIndex) {
        return res.status(400).json({
          error: 'Target level must be higher than current level',
          code: 'INVALID_LEVEL_PROGRESSION'
        });
      }
    }

    Object.assign(skill, updates);
    await skill.save();

    res.json({
      message: 'Skill updated successfully',
      code: 'SKILL_UPDATED',
      skill: skill.toObject()
    });

  } catch (error) {
    console.error('Error updating skill:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }

    res.status(500).json({
      error: 'Failed to update skill',
      code: 'UPDATE_ERROR'
    });
  }
});

// DELETE /api/skills/:id - Delete skill
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid skill ID',
        code: 'INVALID_ID'
      });
    }

    const skill = await Skill.findOne({
      _id: id,
      userId: req.userId
    });

    if (!skill) {
      return res.status(404).json({
        error: 'Skill not found',
        code: 'SKILL_NOT_FOUND'
      });
    }

    if (permanent === 'true') {
      // Permanent deletion
      await Skill.deleteOne({ _id: id });
      
      res.json({
        message: 'Skill permanently deleted',
        code: 'SKILL_DELETED'
      });
    } else {
      // Soft delete (archive)
      skill.archived = true;
      await skill.save();
      
      res.json({
        message: 'Skill archived successfully',
        code: 'SKILL_ARCHIVED'
      });
    }

  } catch (error) {
    console.error('Error deleting skill:', error);
    res.status(500).json({
      error: 'Failed to delete skill',
      code: 'DELETE_ERROR'
    });
  }
});

// POST /api/skills/:id/practice - Log practice session
router.post('/:id/practice', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      activity,
      duration, // in minutes
      notes,
      difficulty = 'medium',
      effectiveness,
      practiceDate = new Date()
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid skill ID',
        code: 'INVALID_ID'
      });
    }

    // Validation
    if (!activity || activity.trim().length < 2) {
      return res.status(400).json({
        error: 'Activity description is required',
        code: 'INVALID_ACTIVITY'
      });
    }

    if (!duration || duration < 1) {
      return res.status(400).json({
        error: 'Duration must be at least 1 minute',
        code: 'INVALID_DURATION'
      });
    }

    const skill = await Skill.findOne({
      _id: id,
      userId: req.userId
    });

    if (!skill) {
      return res.status(404).json({
        error: 'Skill not found',
        code: 'SKILL_NOT_FOUND'
      });
    }

    // Add practice session using the model's method
    await skill.addPracticeSession(
      activity.trim(),
      parseInt(duration),
      notes?.trim(),
      difficulty,
      effectiveness
    );

    // Update skill status if it's the first practice session
    if (skill.status === 'not_started') {
      skill.status = 'learning';
      await skill.save();
    }

    const totalPracticeTime = skill.practiceLog.reduce((total, log) => total + log.duration, 0);

    res.status(201).json({
      message: 'Practice session logged successfully',
      code: 'PRACTICE_LOGGED',
      practiceEntry: skill.practiceLog[skill.practiceLog.length - 1],
      analytics: {
        totalPracticeTime,
        practiceStreak: calculatePracticeStreak(skill.practiceLog),
        avgEffectiveness: calculateAvgEffectiveness(skill.practiceLog)
      }
    });

  } catch (error) {
    console.error('Error logging practice:', error);
    res.status(500).json({
      error: 'Failed to log practice session',
      code: 'PRACTICE_LOG_ERROR'
    });
  }
});

// POST /api/skills/:id/progress - Update progress
router.post('/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;
    const { value, note, source = 'manual' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid skill ID',
        code: 'INVALID_ID'
      });
    }

    if (value === undefined || value < 0) {
      return res.status(400).json({
        error: 'Progress value is required and must be non-negative',
        code: 'INVALID_PROGRESS_VALUE'
      });
    }

    const skill = await Skill.findOne({
      _id: id,
      userId: req.userId
    });

    if (!skill) {
      return res.status(404).json({
        error: 'Skill not found',
        code: 'SKILL_NOT_FOUND'
      });
    }

    // Update progress using the model's method
    await skill.updateProgress(value, note, source);

    res.json({
      message: 'Progress updated successfully',
      code: 'PROGRESS_UPDATED',
      currentProgress: skill.progressTracking.currentValue,
      progressPercentage: calculateProgressPercentage(skill)
    });

  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({
      error: 'Failed to update progress',
      code: 'PROGRESS_UPDATE_ERROR'
    });
  }
});

// POST /api/skills/:id/milestones - Add milestone
router.post('/:id/milestones', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, targetValue } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid skill ID',
        code: 'INVALID_ID'
      });
    }

    if (!title || title.trim().length < 2) {
      return res.status(400).json({
        error: 'Milestone title is required',
        code: 'INVALID_TITLE'
      });
    }

    if (targetValue === undefined || targetValue < 0) {
      return res.status(400).json({
        error: 'Target value is required',
        code: 'INVALID_TARGET_VALUE'
      });
    }

    const skill = await Skill.findOne({
      _id: id,
      userId: req.userId
    });

    if (!skill) {
      return res.status(404).json({
        error: 'Skill not found',
        code: 'SKILL_NOT_FOUND'
      });
    }

    const order = skill.progressTracking.milestones.length + 1;
    
    skill.progressTracking.milestones.push({
      title: title.trim(),
      description: description?.trim(),
      targetValue,
      order,
      completed: false
    });

    await skill.save();

    res.status(201).json({
      message: 'Milestone added successfully',
      code: 'MILESTONE_ADDED',
      milestone: skill.progressTracking.milestones[skill.progressTracking.milestones.length - 1]
    });

  } catch (error) {
    console.error('Error adding milestone:', error);
    res.status(500).json({
      error: 'Failed to add milestone',
      code: 'MILESTONE_ADD_ERROR'
    });
  }
});

// PUT /api/skills/:id/milestones/:milestoneId - Update milestone
router.put('/:id/milestones/:milestoneId', async (req, res) => {
  try {
    const { id, milestoneId } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(milestoneId)) {
      return res.status(400).json({
        error: 'Invalid ID format',
        code: 'INVALID_ID'
      });
    }

    const skill = await Skill.findOne({
      _id: id,
      userId: req.userId
    });

    if (!skill) {
      return res.status(404).json({
        error: 'Skill not found',
        code: 'SKILL_NOT_FOUND'
      });
    }

    const milestone = skill.progressTracking.milestones.id(milestoneId);
    if (!milestone) {
      return res.status(404).json({
        error: 'Milestone not found',
        code: 'MILESTONE_NOT_FOUND'
      });
    }

    // Update allowed fields
    const allowedUpdates = ['title', 'description', 'targetValue', 'completed'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        milestone[field] = updates[field];
      }
    });

    // Set completion date if marking as completed
    if (updates.completed === true && !milestone.completedAt) {
      milestone.completedAt = new Date();
    } else if (updates.completed === false) {
      milestone.completedAt = undefined;
    }

    await skill.save();

    res.json({
      message: 'Milestone updated successfully',
      code: 'MILESTONE_UPDATED',
      milestone
    });

  } catch (error) {
    console.error('Error updating milestone:', error);
    res.status(500).json({
      error: 'Failed to update milestone',
      code: 'MILESTONE_UPDATE_ERROR'
    });
  }
});

// POST /api/skills/:id/assessments - Add assessment
router.post('/:id/assessments', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, score, level, notes, assessedBy, certificateUrl } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid skill ID',
        code: 'INVALID_ID'
      });
    }

    if (!type) {
      return res.status(400).json({
        error: 'Assessment type is required',
        code: 'INVALID_TYPE'
      });
    }

    const skill = await Skill.findOne({
      _id: id,
      userId: req.userId
    });

    if (!skill) {
      return res.status(404).json({
        error: 'Skill not found',
        code: 'SKILL_NOT_FOUND'
      });
    }

    // Add assessment using the model's method
    await skill.addAssessment(type, score, level, notes, assessedBy);

    // Add certificate URL if provided
    const newAssessment = skill.assessments[skill.assessments.length - 1];
    if (certificateUrl) {
      newAssessment.certificateUrl = certificateUrl;
      await skill.save();
    }

    res.status(201).json({
      message: 'Assessment added successfully',
      code: 'ASSESSMENT_ADDED',
      assessment: newAssessment,
      updatedLevel: skill.currentLevel
    });

  } catch (error) {
    console.error('Error adding assessment:', error);
    res.status(500).json({
      error: 'Failed to add assessment',
      code: 'ASSESSMENT_ADD_ERROR'
    });
  }
});

// POST /api/skills/:id/link - Link skill to other resources
router.post('/:id/link', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, resourceId, metadata = {} } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid skill ID',
        code: 'INVALID_ID'
      });
    }

    if (!type || !resourceId) {
      return res.status(400).json({
        error: 'Link type and resource ID are required',
        code: 'MISSING_LINK_DATA'
      });
    }

    const skill = await Skill.findOne({
      _id: id,
      userId: req.userId
    });

    if (!skill) {
      return res.status(404).json({
        error: 'Skill not found',
        code: 'SKILL_NOT_FOUND'
      });
    }

    // Link based on type using the model's methods
    try {
      switch (type) {
        case 'project':
          await skill.linkToProject(resourceId, metadata.contribution);
          break;
        case 'book':
          await skill.linkToBook(resourceId, metadata.relevance);
          break;
        case 'goal':
          await skill.linkToGoal(resourceId, metadata.relationship);
          break;
        case 'business':
          await skill.linkToBusiness(resourceId, metadata.application);
          break;
        case 'course':
          await skill.addCourse(metadata.title, metadata.provider, metadata.url);
          break;
        default:
          return res.status(400).json({
            error: 'Invalid link type',
            code: 'INVALID_LINK_TYPE'
          });
      }

      res.status(201).json({
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} linked successfully`,
        code: 'RESOURCE_LINKED',
        linkType: type,
        resourceId
      });

    } catch (linkError) {
      if (linkError.message.includes('already linked')) {
        return res.status(409).json({
          error: linkError.message,
          code: 'RESOURCE_ALREADY_LINKED'
        });
      }
      throw linkError;
    }

  } catch (error) {
    console.error('Error linking resource:', error);
    res.status(500).json({
      error: 'Failed to link resource',
      code: 'LINK_ERROR'
    });
  }
});

// GET /api/skills/analytics/overview - Get skills analytics overview
router.get('/analytics/overview', async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;

    // Calculate date range
    let startDate = new Date();
    switch (timeframe) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    const [
      skillsOverview,
      practiceData,
      categoryBreakdown,
      levelDistribution
    ] = await Promise.all([
      // Skills overview
      Skill.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.userId), archived: false } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalPracticeTime: { 
              $sum: { 
                $reduce: {
                  input: '$practiceLog',
                  initialValue: 0,
                  in: { $add: ['$$value', '$$this.duration'] }
                }
              }
            }
          }
        }
      ]),

      // Practice data for timeframe
      Skill.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.userId), archived: false } },
        { $unwind: '$practiceLog' },
        { $match: { 'practiceLog.practiceDate': { $gte: startDate } } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$practiceLog.practiceDate' } }
            },
            totalMinutes: { $sum: '$practiceLog.duration' },
            sessionCount: { $sum: 1 },
            avgEffectiveness: { $avg: '$practiceLog.effectiveness' }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]),

      // Category breakdown
      Skill.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.userId), archived: false } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalPracticeTime: { 
              $sum: { 
                $reduce: {
                  input: '$practiceLog',
                  initialValue: 0,
                  in: { $add: ['$$value', '$$this.duration'] }
                }
              }
            },
            averageLevel: { $avg: { $indexOfArray: [['beginner', 'novice', 'intermediate', 'advanced', 'expert', 'master'], '$currentLevel'] } }
          }
        }
      ]),

      // Level distribution
      Skill.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.userId), archived: false } },
        {
          $group: {
            _id: '$currentLevel',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Process overview data
    const overview = {
      total: 0,
      learning: 0,
      practicing: 0,
      maintaining: 0,
      mastered: 0,
      totalPracticeTime: 0
    };

    skillsOverview.forEach(item => {
      overview.total += item.count;
      overview.totalPracticeTime += item.totalPracticeTime || 0;
      if (overview.hasOwnProperty(item._id)) {
        overview[item._id] = item.count;
      }
    });

    // Process practice data
    const practiceChart = practiceData.map(item => ({
      date: item._id.date,
      minutes: item.totalMinutes,
      sessions: item.sessionCount,
      hours: Math.round((item.totalMinutes / 60) * 100) / 100,
      avgEffectiveness: item.avgEffectiveness ? Math.round(item.avgEffectiveness * 10) / 10 : null
    }));

    res.json({
      overview,
      practiceData: {
        chart: practiceChart,
        totalMinutes: practiceData.reduce((sum, item) => sum + item.totalMinutes, 0),
        totalHours: Math.round((practiceData.reduce((sum, item) => sum + item.totalMinutes, 0) / 60) * 100) / 100,
        averageSessionsPerDay: practiceData.length > 0 
          ? Math.round((practiceData.reduce((sum, item) => sum + item.sessionCount, 0) / practiceData.length) * 100) / 100
          : 0,
        timeframe
      },
      categoryBreakdown: categoryBreakdown.map(item => ({
        category: item._id,
        count: item.count,
        totalPracticeTime: Math.round((item.totalPracticeTime || 0) / 60 * 100) / 100, // Convert to hours
        averageLevel: item.averageLevel ? Math.round(item.averageLevel * 100) / 100 : 0
      })),
      levelDistribution: levelDistribution.map(item => ({
        level: item._id,
        count: item.count
      }))
    });

  } catch (error) {
    console.error('Error fetching skills analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
});

// GET /api/skills/categories - Get available categories
router.get('/categories', (req, res) => {
  try {
    const categories = [
      'technical', 'programming', 'design', 'business', 'leadership',
      'communication', 'language', 'creative', 'analytical', 'personal',
      'physical', 'academic', 'trade', 'other'
    ];

    res.json({
      categories: categories.map(cat => ({
        value: cat,
        label: cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')
      }))
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      error: 'Failed to fetch categories',
      code: 'CATEGORIES_ERROR'
    });
  }
});

// Helper functions
function calculateProgressPercentage(skill) {
  if (skill.progressTracking?.type === 'percentage') {
    return Math.min(100, skill.progressTracking.currentValue || 0);
  } else if (skill.progressTracking?.type === 'hours' || skill.progressTracking?.type === 'projects') {
    const current = skill.progressTracking.currentValue || 0;
    const target = skill.progressTracking.targetValue || 1;
    return Math.min(100, Math.round((current / target) * 100));
  } else {
    // Calculate based on learning plan completion
    const phases = skill.learningPlan?.phases || [];
    if (phases.length === 0) return 0;
    const completedPhases = phases.filter(phase => phase.completed).length;
    return Math.round((completedPhases / phases.length) * 100);
  }
}

function calculateAvgEffectiveness(practiceLog) {
  if (!practiceLog || practiceLog.length === 0) return 0;
  const logsWithEffectiveness = practiceLog.filter(log => log.effectiveness);
  if (logsWithEffectiveness.length === 0) return 0;
  const sum = logsWithEffectiveness.reduce((total, log) => total + log.effectiveness, 0);
  return Math.round((sum / logsWithEffectiveness.length) * 10) / 10;
}

function calculatePracticeStreak(practiceLog) {
  if (!practiceLog || practiceLog.length === 0) return 0;
  
  const sortedLogs = practiceLog
    .sort((a, b) => new Date(b.practiceDate) - new Date(a.practiceDate));
  
  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  for (const log of sortedLogs) {
    const logDate = new Date(log.practiceDate);
    logDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((currentDate - logDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === streak) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else if (daysDiff === streak + 1) {
      // Allow for one day gap
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  return streak;
}

function getWeeklyPracticeTime(practiceLog) {
  if (!practiceLog || practiceLog.length === 0) return 0;
  
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  return practiceLog
    .filter(log => new Date(log.practiceDate) >= oneWeekAgo)
    .reduce((total, log) => total + (log.duration || 0), 0);
}

function getNextPhase(phases) {
  if (!phases || phases.length === 0) return null;
  return phases.find(phase => !phase.completed) || null;
}

function calculatePhaseProgress(phases) {
  if (!phases || phases.length === 0) return { completed: 0, total: 0, percentage: 0 };
  
  const completed = phases.filter(phase => phase.completed).length;
  const total = phases.length;
  const percentage = Math.round((completed / total) * 100);
  
  return { completed, total, percentage };
}

module.exports = router;