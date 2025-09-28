const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Task = require('../models/tasksModel');
const Project = require('../models/projectsModel');
const { authenticateUser } = require('../middleware/auth'); // Import existing JWT auth middleware

// Apply JWT authentication middleware to all routes
router.use(authenticateUser);

// GET /api/tasks - Get all tasks for user with advanced filtering
router.get('/', async (req, res) => {
  try {
    console.log('📋 Tasks list requested for user:', req.userId);
    
    const {
      status,
      urgency,
      importance,
      category,
      linkedType,
      projectId,
      goalId,
      businessId,
      quadrant, // Eisenhower Matrix quadrant
      overdue,
      dueToday,
      search,
      sort = 'priority',
      order = 'desc',
      page = 1,
      limit = 20,
      archived = false
    } = req.query;

    // Build filter - req.userId is set by authenticateUser middleware
    const filter = { userId: req.userId, isArchived: archived === 'true' };
    
    if (status && status !== 'all') {
      const statusArray = status.split(',');
      filter.status = { $in: statusArray };
    }
    
    if (urgency && urgency !== 'all') {
      filter.urgency = urgency;
    }
    
    if (importance && importance !== 'all') {
      filter.importance = importance;
    }
    
    if (category && category !== 'all') {
      filter.category = category;
    }
    
    if (linkedType && linkedType !== 'all') {
      filter['linkedTo.type'] = linkedType;
    }
    
    if (projectId) {
      filter['linkedTo.projectId'] = projectId;
    }
    
    if (goalId) {
      filter['linkedTo.goalId'] = goalId;
    }
    
    if (businessId) {
      filter['linkedTo.businessId'] = businessId;
    }
    
    // Eisenhower Matrix quadrant filter
    if (quadrant) {
      const quadrantConditions = {
        Q1: { urgency: { $in: ['high', 'critical'] }, importance: { $in: ['high', 'critical'] } },
        Q2: { urgency: { $in: ['low', 'medium'] }, importance: { $in: ['high', 'critical'] } },
        Q3: { urgency: { $in: ['high', 'critical'] }, importance: { $in: ['low', 'medium'] } },
        Q4: { urgency: { $in: ['low', 'medium'] }, importance: { $in: ['low', 'medium'] } }
      };
      
      if (quadrantConditions[quadrant]) {
        Object.assign(filter, quadrantConditions[quadrant]);
      }
    }
    
    // Overdue filter
    if (overdue === 'true') {
      filter.deadline = { $lt: new Date() };
      filter.status = { $ne: 'completed' };
    }
    
    // Due today filter
    if (dueToday === 'true') {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));
      filter.deadline = { $gte: startOfDay, $lte: endOfDay };
      filter.status = { $ne: 'completed' };
    }
    
    // Search filter
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Build sort
    const sortObj = {};
    switch (sort) {
      case 'priority':
        // Sort by priority score (calculated virtual)
        sortObj.urgency = order === 'desc' ? -1 : 1;
        sortObj.importance = order === 'desc' ? -1 : 1;
        sortObj.deadline = 1; // Earlier deadlines first
        break;
      case 'deadline':
        sortObj.deadline = order === 'desc' ? -1 : 1;
        break;
      case 'created':
        sortObj.createdAt = order === 'desc' ? -1 : 1;
        break;
      case 'updated':
        sortObj.updatedAt = order === 'desc' ? -1 : 1;
        break;
      case 'title':
        sortObj.title = order === 'desc' ? -1 : 1;
        break;
      default:
        sortObj.createdAt = -1;
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate('linkedTo.projectId', 'title status category')
        .populate('linkedTo.goalId', 'title status')
        .populate('linkedTo.businessId', 'name')
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Task.countDocuments(filter)
    ]);

    // Add computed fields
    const enrichedTasks = tasks.map(task => ({
      ...task,
      eisenhowerQuadrant: getEisenhowerQuadrant(task.urgency, task.importance),
      priorityScore: calculatePriorityScore(task.urgency, task.importance),
      isOverdue: task.deadline && task.deadline < new Date() && task.status !== 'completed',
      daysUntilDeadline: task.deadline ? Math.ceil((task.deadline - new Date()) / (1000 * 60 * 60 * 24)) : null,
      subtaskProgress: task.subtasks?.length > 0 
        ? Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100)
        : 100,
      canStart: checkCanStart(task),
      nextReminder: task.reminders?.find(r => !r.sent && r.reminderTime > new Date())
    }));

    // Get summary statistics
    const summary = await getTasksSummary(req.userId);

    console.log('📋 Tasks response:', {
      totalTasks: total,
      activeTasks: summary.active,
      completedTasks: summary.completed
    });

    res.json({
      tasks: enrichedTasks,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrev: parseInt(page) > 1
      },
      summary
    });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      error: 'Failed to fetch tasks',
      code: 'FETCH_ERROR'
    });
  }
});

// GET /api/tasks/:id - Get specific task
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid task ID',
        code: 'INVALID_ID'
      });
    }

    const task = await Task.findOne({
      _id: id,
      userId: req.userId
    })
    .populate('linkedTo.projectId', 'title status category milestones')
    .populate('linkedTo.goalId', 'title status targetDate')
    .populate('linkedTo.businessId', 'name industry')
    .populate('dependencies.taskId', 'title status')
    .lean();

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    // Add computed analytics
    const taskWithAnalytics = {
      ...task,
      analytics: {
        eisenhowerQuadrant: getEisenhowerQuadrant(task.urgency, task.importance),
        priorityScore: calculatePriorityScore(task.urgency, task.importance),
        isOverdue: task.deadline && task.deadline < new Date() && task.status !== 'completed',
        daysUntilDeadline: task.deadline ? Math.ceil((task.deadline - new Date()) / (1000 * 60 * 60 * 24)) : null,
        subtaskProgress: task.subtasks?.length > 0 
          ? Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100)
          : 100,
        timeEfficiency: task.estimatedTime && task.actualTime 
          ? Math.round((task.estimatedTime / task.actualTime) * 100)
          : null,
        blockedBy: task.dependencies?.filter(dep => dep.type === 'blocks' && dep.taskId?.status !== 'completed') || [],
        blocking: await Task.find({
          userId: req.userId,
          'dependencies.taskId': task._id,
          'dependencies.type': 'blocks'
        }, 'title status').lean(),
        relatedTasks: task.linkedTo?.type !== 'none' 
          ? await getRelatedTasks(req.userId, task.linkedTo)
          : [],
        nextRecurrence: task.recurring?.isRecurring && task.recurring.nextDue 
          ? task.recurring.nextDue
          : null
      }
    };

    res.json(taskWithAnalytics);

  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({
      error: 'Failed to fetch task',
      code: 'FETCH_ERROR'
    });
  }
});

// POST /api/tasks - Create new task
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      urgency = 'medium',
      importance = 'medium',
      deadline,
      estimatedTime,
      category = 'personal',
      tags = [],
      linkedTo = { type: 'none' },
      subtasks = [],
      recurring = { isRecurring: false },
      dependencies = []
    } = req.body;

    // Validation
    const validationErrors = [];

    if (!title || title.trim().length < 2) {
      validationErrors.push('Task title must be at least 2 characters long');
    }

    if (title && title.trim().length > 200) {
      validationErrors.push('Task title cannot exceed 200 characters');
    }

    if (deadline && new Date(deadline) < new Date()) {
      validationErrors.push('Deadline cannot be in the past');
    }

    if (estimatedTime && estimatedTime < 0) {
      validationErrors.push('Estimated time must be positive');
    }

    // Validate linked resource exists if specified
    if (linkedTo.type !== 'none') {
      const isValidLink = await validateLinkedResource(linkedTo, req.userId);
      if (!isValidLink) {
        validationErrors.push(`Invalid ${linkedTo.type} reference`);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }

    // Create task
    const task = new Task({
      userId: req.userId,
      title: title.trim(),
      description: description?.trim(),
      urgency,
      importance,
      deadline: deadline ? new Date(deadline) : undefined,
      estimatedTime,
      category,
      tags: tags.map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0),
      linkedTo,
      subtasks: subtasks.map((subtask, index) => ({
        title: subtask.title.trim(),
        completed: false,
        order: index + 1
      })),
      recurring,
      dependencies: dependencies.filter(dep => mongoose.Types.ObjectId.isValid(dep.taskId))
    });

    await task.save();

    // Populate linked resources for response
    await task.populate([
      { path: 'linkedTo.projectId', select: 'title status' },
      { path: 'linkedTo.goalId', select: 'title status' },
      { path: 'linkedTo.businessId', select: 'name' }
    ]);

    res.status(201).json({
      message: 'Task created successfully',
      code: 'TASK_CREATED',
      task: {
        ...task.toObject(),
        eisenhowerQuadrant: getEisenhowerQuadrant(task.urgency, task.importance),
        priorityScore: calculatePriorityScore(task.urgency, task.importance)
      }
    });

    console.log(`New task created: ${task.title} for user ${req.userId}`);

  } catch (error) {
    console.error('Error creating task:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }

    res.status(500).json({
      error: 'Failed to create task',
      code: 'CREATE_ERROR'
    });
  }
});

// PUT /api/tasks/:id - Update task
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid task ID',
        code: 'INVALID_ID'
      });
    }

    const task = await Task.findOne({
      _id: id,
      userId: req.userId
    });

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'title', 'description', 'urgency', 'importance', 'deadline',
      'estimatedTime', 'actualTime', 'category', 'tags', 'linkedTo',
      'status', 'recurring'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Validate deadline if being updated
    if (updates.deadline && new Date(updates.deadline) < new Date()) {
      return res.status(400).json({
        error: 'Deadline cannot be in the past',
        code: 'INVALID_DEADLINE'
      });
    }

    // Validate linked resource if being updated
    if (updates.linkedTo && updates.linkedTo.type !== 'none') {
      const isValidLink = await validateLinkedResource(updates.linkedTo, req.userId);
      if (!isValidLink) {
        return res.status(400).json({
          error: `Invalid ${updates.linkedTo.type} reference`,
          code: 'INVALID_LINK'
        });
      }
    }

    Object.assign(task, updates);
    await task.save();

    // Populate for response
    await task.populate([
      { path: 'linkedTo.projectId', select: 'title status' },
      { path: 'linkedTo.goalId', select: 'title status' },
      { path: 'linkedTo.businessId', select: 'name' }
    ]);

    res.json({
      message: 'Task updated successfully',
      code: 'TASK_UPDATED',
      task: {
        ...task.toObject(),
        eisenhowerQuadrant: getEisenhowerQuadrant(task.urgency, task.importance),
        priorityScore: calculatePriorityScore(task.urgency, task.importance)
      }
    });

  } catch (error) {
    console.error('Error updating task:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }

    res.status(500).json({
      error: 'Failed to update task',
      code: 'UPDATE_ERROR'
    });
  }
});

// PATCH /api/tasks/:id/status - Update task status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actualTime } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid task ID',
        code: 'INVALID_ID'
      });
    }

    if (!status) {
      return res.status(400).json({
        error: 'Status is required',
        code: 'MISSING_STATUS'
      });
    }

    const task = await Task.findOne({
      _id: id,
      userId: req.userId
    });

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    // Use the model's method to update status
    await task.updateStatus(status, actualTime);

    // Handle recurring task creation
    let recurringTask = null;
    if (status === 'completed' && task.recurring?.isRecurring) {
      try {
        const [updatedTask, newRecurringTask] = await task.createRecurringInstance();
        recurringTask = newRecurringTask;
      } catch (recurringError) {
        console.warn('Failed to create recurring task instance:', recurringError.message);
      }
    }

    res.json({
      message: 'Task status updated successfully',
      code: 'STATUS_UPDATED',
      task: task.toObject(),
      recurringTask: recurringTask?.toObject() || null
    });

  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({
      error: 'Failed to update task status',
      code: 'STATUS_UPDATE_ERROR'
    });
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid task ID',
        code: 'INVALID_ID'
      });
    }

    const task = await Task.findOne({
      _id: id,
      userId: req.userId
    });

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    if (permanent === 'true') {
      // Check for dependencies before permanent deletion
      const dependentTasks = await Task.find({
        userId: req.userId,
        'dependencies.taskId': id
      }, 'title').lean();

      if (dependentTasks.length > 0) {
        return res.status(400).json({
          error: 'Cannot delete task that other tasks depend on',
          code: 'HAS_DEPENDENCIES',
          dependentTasks: dependentTasks.map(t => t.title)
        });
      }

      await Task.deleteOne({ _id: id });
      
      res.json({
        message: 'Task permanently deleted',
        code: 'TASK_DELETED'
      });
    } else {
      // Soft delete (archive)
      await task.archive();
      
      res.json({
        message: 'Task archived successfully',
        code: 'TASK_ARCHIVED'
      });
    }

  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      error: 'Failed to delete task',
      code: 'DELETE_ERROR'
    });
  }
});

// POST /api/tasks/:id/subtasks - Add subtask
router.post('/:id/subtasks', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid task ID',
        code: 'INVALID_ID'
      });
    }

    if (!title || title.trim().length < 2) {
      return res.status(400).json({
        error: 'Subtask title is required',
        code: 'INVALID_TITLE'
      });
    }

    const task = await Task.findOne({
      _id: id,
      userId: req.userId
    });

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    await task.addSubtask(title.trim());

    res.status(201).json({
      message: 'Subtask added successfully',
      code: 'SUBTASK_ADDED',
      subtask: task.subtasks[task.subtasks.length - 1],
      subtaskProgress: Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100)
    });

  } catch (error) {
    console.error('Error adding subtask:', error);
    res.status(500).json({
      error: 'Failed to add subtask',
      code: 'SUBTASK_ADD_ERROR'
    });
  }
});

// PATCH /api/tasks/:id/subtasks/:subtaskIndex - Update subtask
router.patch('/:id/subtasks/:subtaskIndex', async (req, res) => {
  try {
    const { id, subtaskIndex } = req.params;
    const { completed, title } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid task ID',
        code: 'INVALID_ID'
      });
    }

    const task = await Task.findOne({
      _id: id,
      userId: req.userId
    });

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    const subtaskIdx = parseInt(subtaskIndex);
    if (!task.subtasks[subtaskIdx]) {
      return res.status(404).json({
        error: 'Subtask not found',
        code: 'SUBTASK_NOT_FOUND'
      });
    }

    // Update subtask
    if (title !== undefined) {
      task.subtasks[subtaskIdx].title = title.trim();
    }

    if (completed !== undefined) {
      if (completed && !task.subtasks[subtaskIdx].completed) {
        await task.completeSubtask(subtaskIdx);
      } else if (!completed) {
        task.subtasks[subtaskIdx].completed = false;
        task.subtasks[subtaskIdx].completedAt = undefined;
        await task.save();
      }
    }

    const subtaskProgress = Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100);

    res.json({
      message: 'Subtask updated successfully',
      code: 'SUBTASK_UPDATED',
      subtask: task.subtasks[subtaskIdx],
      subtaskProgress
    });

  } catch (error) {
    console.error('Error updating subtask:', error);
    res.status(500).json({
      error: 'Failed to update subtask',
      code: 'SUBTASK_UPDATE_ERROR'
    });
  }
});

// DELETE /api/tasks/:id/subtasks/:subtaskIndex - Delete subtask
router.delete('/:id/subtasks/:subtaskIndex', async (req, res) => {
  try {
    const { id, subtaskIndex } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid task ID',
        code: 'INVALID_ID'
      });
    }

    const task = await Task.findOne({
      _id: id,
      userId: req.userId
    });

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    const subtaskIdx = parseInt(subtaskIndex);
    if (!task.subtasks[subtaskIdx]) {
      return res.status(404).json({
        error: 'Subtask not found',
        code: 'SUBTASK_NOT_FOUND'
      });
    }

    task.subtasks.splice(subtaskIdx, 1);
    
    // Reorder remaining subtasks
    task.subtasks.forEach((subtask, index) => {
      subtask.order = index + 1;
    });

    await task.save();

    const subtaskProgress = task.subtasks.length > 0 
      ? Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100)
      : 100;

    res.json({
      message: 'Subtask deleted successfully',
      code: 'SUBTASK_DELETED',
      subtaskProgress
    });

  } catch (error) {
    console.error('Error deleting subtask:', error);
    res.status(500).json({
      error: 'Failed to delete subtask',
      code: 'SUBTASK_DELETE_ERROR'
    });
  }
});

// POST /api/tasks/:id/notes - Add note to task
router.post('/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid task ID',
        code: 'INVALID_ID'
      });
    }

    if (!content || content.trim().length < 1) {
      return res.status(400).json({
        error: 'Note content is required',
        code: 'INVALID_CONTENT'
      });
    }

    const task = await Task.findOne({
      _id: id,
      userId: req.userId
    });

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    await task.addNote(content.trim());

    res.status(201).json({
      message: 'Note added successfully',
      code: 'NOTE_ADDED',
      note: task.notes[task.notes.length - 1]
    });

  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({
      error: 'Failed to add note',
      code: 'NOTE_ADD_ERROR'
    });
  }
});

// POST /api/tasks/:id/reminders - Set reminder for task
router.post('/:id/reminders', async (req, res) => {
  try {
    const { id } = req.params;
    const { reminderTime, message = '' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid task ID',
        code: 'INVALID_ID'
      });
    }

    if (!reminderTime) {
      return res.status(400).json({
        error: 'Reminder time is required',
        code: 'MISSING_REMINDER_TIME'
      });
    }

    if (new Date(reminderTime) < new Date()) {
      return res.status(400).json({
        error: 'Reminder time cannot be in the past',
        code: 'INVALID_REMINDER_TIME'
      });
    }

    const task = await Task.findOne({
      _id: id,
      userId: req.userId
    });

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    await task.setReminder(new Date(reminderTime), message.trim());

    res.status(201).json({
      message: 'Reminder set successfully',
      code: 'REMINDER_SET',
      reminder: task.reminders[task.reminders.length - 1]
    });

  } catch (error) {
    console.error('Error setting reminder:', error);
    res.status(500).json({
      error: 'Failed to set reminder',
      code: 'REMINDER_SET_ERROR'
    });
  }
});

// POST /api/tasks/:id/link - Link task to project/goal/business
router.post('/:id/link', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, resourceId, milestoneIndex } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid task ID',
        code: 'INVALID_ID'
      });
    }

    if (!type || !resourceId) {
      return res.status(400).json({
        error: 'Link type and resource ID are required',
        code: 'MISSING_LINK_DATA'
      });
    }

    const task = await Task.findOne({
      _id: id,
      userId: req.userId
    });

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    // Validate linked resource
    const linkedTo = { type, [type + 'Id']: resourceId };
    if (milestoneIndex !== undefined) {
      linkedTo.milestoneIndex = milestoneIndex;
    }

    const isValidLink = await validateLinkedResource(linkedTo, req.userId);
    if (!isValidLink) {
      return res.status(400).json({
        error: `Invalid ${type} reference`,
        code: 'INVALID_LINK'
      });
    }

    // Link using model methods
    try {
      switch (type) {
        case 'project':
          await task.linkToProject(resourceId, milestoneIndex);
          break;
        case 'goal':
          await task.linkToGoal(resourceId);
          break;
        case 'business':
          await task.linkToBusiness(resourceId);
          break;
        default:
          return res.status(400).json({
            error: 'Invalid link type',
            code: 'INVALID_LINK_TYPE'
          });
      }

      res.json({
        message: `Task linked to ${type} successfully`,
        code: 'TASK_LINKED',
        linkedTo: task.linkedTo
      });

    } catch (linkError) {
      throw linkError;
    }

  } catch (error) {
    console.error('Error linking task:', error);
    res.status(500).json({
      error: 'Failed to link task',
      code: 'LINK_ERROR'
    });
  }
});

// DELETE /api/tasks/:id/link - Unlink task from all resources
router.delete('/:id/link', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid task ID',
        code: 'INVALID_ID'
      });
    }

    const task = await Task.findOne({
      _id: id,
      userId: req.userId
    });

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    await task.unlinkFromAll();

    res.json({
      message: 'Task unlinked successfully',
      code: 'TASK_UNLINKED',
      linkedTo: task.linkedTo
    });

  } catch (error) {
    console.error('Error unlinking task:', error);
    res.status(500).json({
      error: 'Failed to unlink task',
      code: 'UNLINK_ERROR'
    });
  }
});

// GET /api/tasks/analytics/overview - Get tasks analytics overview  
router.get('/analytics/overview', async (req, res) => {
  try {
    console.log('📊 Tasks analytics overview requested for user:', req.userId);
    
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
      statusBreakdown,
      quadrantBreakdown,
      categoryBreakdown,
      completionTrend,
      timeEfficiency
    ] = await Promise.all([
      // Status breakdown
      Task.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.userId), isArchived: false } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalEstimatedTime: { $sum: '$estimatedTime' },
            totalActualTime: { $sum: '$actualTime' }
          }
        }
      ]),

      // Eisenhower Matrix breakdown
      Task.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.userId), isArchived: false, status: { $ne: 'completed' } } },
        {
          $group: {
            _id: {
              urgency: '$urgency',
              importance: '$importance'
            },
            count: { $sum: 1 }
          }
        }
      ]),

      // Category breakdown
      Task.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.userId), isArchived: false } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            }
          }
        }
      ]),

      // Completion trend
      Task.aggregate([
        { 
          $match: { 
            userId: new mongoose.Types.ObjectId(req.userId), 
            isArchived: false,
            completedAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }
            },
            completed: { $sum: 1 },
            totalActualTime: { $sum: '$actualTime' }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]),

      // Time efficiency analysis
      Task.aggregate([
        { 
          $match: { 
            userId: new mongoose.Types.ObjectId(req.userId), 
            isArchived: false,
            status: 'completed',
            estimatedTime: { $gt: 0 },
            actualTime: { $gt: 0 }
          }
        },
        {
          $project: {
            efficiency: { 
              $multiply: [
                { $divide: ['$estimatedTime', '$actualTime'] },
                100
              ]
            },
            category: 1,
            completedAt: 1
          }
        },
        {
          $group: {
            _id: null,
            avgEfficiency: { $avg: '$efficiency' },
            taskCount: { $sum: 1 }
          }
        }
      ])
    ]);

    // Process Eisenhower Matrix data
    const quadrants = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    quadrantBreakdown.forEach(item => {
      const urgencyLevel = ['low', 'medium', 'high', 'critical'].indexOf(item._id.urgency);
      const importanceLevel = ['low', 'medium', 'high', 'critical'].indexOf(item._id.importance);
      
      let quadrant;
      if (urgencyLevel >= 2 && importanceLevel >= 2) quadrant = 'Q1';
      else if (urgencyLevel < 2 && importanceLevel >= 2) quadrant = 'Q2';
      else if (urgencyLevel >= 2 && importanceLevel < 2) quadrant = 'Q3';
      else quadrant = 'Q4';
      
      quadrants[quadrant] += item.count;
    });

    // Get additional summary data
    const summary = await getTasksSummary(req.userId);

    console.log('📊 Tasks analytics response:', {
      totalTasks: summary.total,
      activeTasks: summary.active,
      completedTasks: summary.completed,
      overdueTasks: summary.overdue
    });

    res.json({
      summary,
      statusBreakdown: statusBreakdown.map(item => ({
        status: item._id,
        count: item.count,
        totalEstimatedTime: item.totalEstimatedTime || 0,
        totalActualTime: item.totalActualTime || 0
      })),
      eisenhowerMatrix: quadrants,
      categoryBreakdown: categoryBreakdown.map(item => ({
        category: item._id,
        total: item.count,
        completed: item.completed,
        completionRate: item.count > 0 ? Math.round((item.completed / item.count) * 100) : 0
      })),
      completionTrend: completionTrend.map(item => ({
        date: item._id.date,
        completed: item.completed,
        totalTime: item.totalActualTime || 0
      })),
      timeEfficiency: timeEfficiency[0] || { avgEfficiency: 0, taskCount: 0 },
      timeframe
    });

  } catch (error) {
    console.error('Error fetching tasks analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
});

// GET /api/tasks/eisenhower/:quadrant - Get tasks by Eisenhower Matrix quadrant
router.get('/eisenhower/:quadrant', async (req, res) => {
  try {
    const { quadrant } = req.params;
    const { limit = 10 } = req.query;

    if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(quadrant)) {
      return res.status(400).json({
        error: 'Invalid quadrant. Must be Q1, Q2, Q3, or Q4',
        code: 'INVALID_QUADRANT'
      });
    }

    const tasks = await Task.getByEisenhowerQuadrant(req.userId, quadrant);
    const limitedTasks = tasks.slice(0, parseInt(limit));

    const enrichedTasks = limitedTasks.map(task => ({
      ...task.toObject(),
      eisenhowerQuadrant: quadrant,
      priorityScore: calculatePriorityScore(task.urgency, task.importance),
      isOverdue: task.deadline && task.deadline < new Date() && task.status !== 'completed',
      daysUntilDeadline: task.deadline ? Math.ceil((task.deadline - new Date()) / (1000 * 60 * 60 * 24)) : null
    }));

    res.json({
      quadrant,
      tasks: enrichedTasks,
      total: tasks.length,
      showing: limitedTasks.length
    });

  } catch (error) {
    console.error('Error fetching quadrant tasks:', error);
    res.status(500).json({
      error: 'Failed to fetch quadrant tasks',
      code: 'QUADRANT_FETCH_ERROR'
    });
  }
});

// Helper functions
function getEisenhowerQuadrant(urgency, importance) {
  const urgencyLevel = ['low', 'medium', 'high', 'critical'].indexOf(urgency);
  const importanceLevel = ['low', 'medium', 'high', 'critical'].indexOf(importance);
  
  if (urgencyLevel >= 2 && importanceLevel >= 2) return 'Q1'; // Do First
  if (urgencyLevel < 2 && importanceLevel >= 2) return 'Q2'; // Schedule
  if (urgencyLevel >= 2 && importanceLevel < 2) return 'Q3'; // Delegate
  return 'Q4'; // Eliminate
}

function calculatePriorityScore(urgency, importance) {
  const urgencyWeight = ['low', 'medium', 'high', 'critical'].indexOf(urgency) + 1;
  const importanceWeight = ['low', 'medium', 'high', 'critical'].indexOf(importance) + 1;
  
  return (importanceWeight * 3) + (urgencyWeight * 2);
}

function checkCanStart(task) {
  if (!task.dependencies || task.dependencies.length === 0) return true;
  
  // For this simplified version, assume task can start if it has no blocking dependencies
  return !task.dependencies.some(dep => dep.type === 'blocks');
}

async function validateLinkedResource(linkedTo, userId) {
  try {
    switch (linkedTo.type) {
      case 'project':
        const project = await Project.findOne({
          _id: linkedTo.projectId,
          userId
        });
        return !!project;
      
      case 'goal':
        // Assuming you have a Goal model
        const Goal = require('../models/goalsModel');
        const goal = await Goal.findOne({
          _id: linkedTo.goalId,
          userId
        });
        return !!goal;
      
      case 'business':
        // Assuming you have a Business model
        const Business = require('../models/businessModel');
        const business = await Business.findOne({
          _id: linkedTo.businessId,
          userId
        });
        return !!business;
      
      default:
        return false;
    }
  } catch (error) {
    console.error('Error validating linked resource:', error);
    return false;
  }
}

async function getRelatedTasks(userId, linkedTo) {
  try {
    const filter = {
      userId,
      isArchived: false,
      'linkedTo.type': linkedTo.type
    };
    
    filter[`linkedTo.${linkedTo.type}Id`] = linkedTo[`${linkedTo.type}Id`];
    
    return await Task.find(filter, 'title status urgency importance deadline')
      .limit(5)
      .lean();
  } catch (error) {
    console.error('Error fetching related tasks:', error);
    return [];
  }
}

async function getTasksSummary(userId) {
  try {
    const [
      totalTasks,
      activeTasks,
      completedTasks,
      overdueTasks,
      dueTodayTasks
    ] = await Promise.all([
      Task.countDocuments({ userId, isArchived: false }),
      Task.countDocuments({ userId, isArchived: false, status: { $in: ['not_started', 'in_progress'] } }),
      Task.countDocuments({ userId, isArchived: false, status: 'completed' }),
      Task.countDocuments({ 
        userId, 
        isArchived: false,
        deadline: { $lt: new Date() },
        status: { $ne: 'completed' }
      }),
      Task.countDocuments({ 
        userId, 
        isArchived: false,
        deadline: { 
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lte: new Date(new Date().setHours(23, 59, 59, 999))
        },
        status: { $ne: 'completed' }
      })
    ]);

    return {
      total: totalTasks,
      active: activeTasks,
      completed: completedTasks,
      overdue: overdueTasks,
      dueToday: dueTodayTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    };
  } catch (error) {
    console.error('Error calculating tasks summary:', error);
    return {
      total: 0,
      active: 0,
      completed: 0,
      overdue: 0,
      dueToday: 0,
      completionRate: 0
    };
  }
}

module.exports = router;