const express = require('express');
const router = express.Router();
const Project = require('../models/projectsModel');
const Task = require('../models/tasksModel');
const Goal = require('../models/goalsModel');
const Reading = require('../models/readingModel');
const Skill = require('../models/skillsModel');
const Business = require('../models/businessModel');
const Income = require('../models/incomeModel');
const Expense = require('../models/expenseModel');
const Budget = require('../models/budgetModel');
const { authenticateUser } = require('../middleware/auth');

// Helper function to safely execute async operations with fallback
const safeAsyncCall = async (asyncFn, fallback = {}) => {
  try {
    return await asyncFn();
  } catch (error) {
    console.warn('Safe async call failed:', error.message);
    return fallback;
  }
};

// Helper function to calculate project progress
const calculateProjectProgress = (milestones) => {
  if (!milestones || milestones.length === 0) return 0;
  const completedMilestones = milestones.filter(milestone => milestone.completed).length;
  return Math.round((completedMilestones / milestones.length) * 100);
};

// Helper function to generate upcoming calendar events
const generateUpcomingEvents = (tasksData, projectsData) => {
  const events = [];
  const today = new Date();

  // Add task due dates
  if (tasksData?.upcomingDeadlines) {
    tasksData.upcomingDeadlines.forEach(task => {
      events.push({
        id: `task-${task.id}`,
        type: 'task',
        title: task.title,
        date: new Date(task.deadline),
        color: 'blue',
        icon: 'ClipboardDocumentListIcon'
      });
    });
  }

  // Add project deadlines
  if (projectsData?.upcomingDeadlines) {
    projectsData.upcomingDeadlines.forEach(project => {
      events.push({
        id: `project-${project.id}`,
        type: 'project',
        title: `${project.title} deadline`,
        date: new Date(project.targetCompletionDate),
        color: 'purple',
        icon: 'FolderIcon'
      });
    });
  }

  // Sort by date and take first 5
  return events
    .sort((a, b) => a.date - b.date)
    .slice(0, 5)
    .map(event => ({
      ...event,
      dateString: event.date.toLocaleDateString('en-GB', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }),
      isToday: event.date.toDateString() === today.toDateString(),
      isOverdue: event.date < today
    }));
};

// GET /api/home/dashboard - Single endpoint for all dashboard data
router.get('/dashboard', authenticateUser, async (req, res) => {
  try {
    console.log('📊 Fetching comprehensive dashboard data for user:', req.userId);

    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Execute all data fetching operations in parallel with error handling
    const [
      tasksData,
      projectsData,
      goalsData,
      readingData,
      skillsData,
      businessesData,
      financesData
    ] = await Promise.all([
      // Tasks data
      safeAsyncCall(async () => {
        const [tasks, overdueTasks, todayTasks] = await Promise.all([
          Task.find({ 
            userId: req.userId, 
            isArchived: false 
          }).lean(),
          Task.find({
            userId: req.userId,
            isArchived: false,
            status: { $ne: 'completed' },
            deadline: { $lt: now }
          }).lean(),
          Task.find({
            userId: req.userId,
            isArchived: false,
            status: { $ne: 'completed' },
            deadline: { 
              $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
              $lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
            }
          }).lean()
        ]);

        const upcomingDeadlines = tasks
          .filter(task => task.deadline && task.deadline > now && task.status !== 'completed')
          .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
          .slice(0, 5)
          .map(task => ({
            id: task._id,
            title: task.title,
            deadline: task.deadline
          }));

        return {
          summary: {
            total: tasks.length,
            completed: tasks.filter(t => t.status === 'completed').length,
            active: tasks.filter(t => t.status === 'in_progress').length,
            pending: tasks.filter(t => t.status === 'not_started').length,
            overdue: overdueTasks.length,
            dueToday: todayTasks.length
          },
          upcomingDeadlines
        };
      }, { 
        summary: { total: 0, completed: 0, active: 0, pending: 0, overdue: 0, dueToday: 0 }, 
        upcomingDeadlines: [] 
      }),

      // Projects data
      safeAsyncCall(async () => {
        // Try to use findAccessibleToUser if available, otherwise fallback to basic query
        let projects;
        try {
          if (Project.findAccessibleToUser) {
            projects = await Project.findAccessibleToUser(req.userId).lean();
          } else {
            projects = await Project.find({ userId: req.userId, archived: { $ne: true } }).lean();
          }
        } catch (error) {
          projects = await Project.find({ userId: req.userId }).lean();
        }

        const upcomingDeadlines = projects
          .filter(project => 
            project.targetCompletionDate && 
            project.targetCompletionDate > now && 
            !['completed', 'cancelled'].includes(project.status)
          )
          .sort((a, b) => new Date(a.targetCompletionDate) - new Date(b.targetCompletionDate))
          .slice(0, 5)
          .map(project => ({
            id: project._id,
            title: project.title,
            targetCompletionDate: project.targetCompletionDate,
            daysUntilDeadline: Math.ceil((new Date(project.targetCompletionDate) - now) / (1000 * 60 * 60 * 24))
          }));

        const overdueProjects = projects.filter(project =>
          project.targetCompletionDate &&
          new Date(project.targetCompletionDate) < now &&
          !['completed', 'cancelled'].includes(project.status)
        ).map(project => ({
          id: project._id,
          title: project.title,
          targetCompletionDate: project.targetCompletionDate,
          daysOverdue: Math.ceil((now - new Date(project.targetCompletionDate)) / (1000 * 60 * 60 * 24))
        }));

        // Calculate category distribution
        const categoryCount = {};
        projects.forEach(project => {
          const category = project.category || 'other';
          categoryCount[category] = (categoryCount[category] || 0) + 1;
        });

        const categories = Object.entries(categoryCount)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        return {
          overview: {
            totalProjects: projects.length,
            activeProjects: projects.filter(p => p.status === 'active').length,
            completedProjects: projects.filter(p => p.status === 'completed').length,
            planningProjects: projects.filter(p => p.status === 'planning').length,
            onHoldProjects: projects.filter(p => p.status === 'on_hold').length,
            cancelledProjects: projects.filter(p => p.status === 'cancelled').length,
            overdueProjects: overdueProjects.length
          },
          categories,
          upcomingDeadlines,
          overdueProjects,
          recentProjects: projects
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .slice(0, 5)
            .map(p => ({
              id: p._id,
              title: p.title,
              status: p.status,
              updatedAt: p.updatedAt,
              progress: calculateProjectProgress(p.milestones),
              isOwner: p.userId.toString() === req.userId
            }))
        };
      }, { 
        overview: { totalProjects: 0, activeProjects: 0, completedProjects: 0 }, 
        categories: [],
        upcomingDeadlines: [],
        overdueProjects: [],
        recentProjects: []
      }),

      // Goals data
      safeAsyncCall(async () => {
        const goals = await Goal.find({ userId: req.userId }).lean();
        
        return {
          overview: {
            total: goals.length,
            achieved: goals.filter(g => g.status === 'achieved').length,
            inProgress: goals.filter(g => g.status === 'in_progress').length,
            notStarted: goals.filter(g => g.status === 'not_started').length,
            paused: goals.filter(g => g.status === 'paused').length
          }
        };
      }, { 
        overview: { total: 0, achieved: 0, inProgress: 0, notStarted: 0, paused: 0 } 
      }),

      // Reading data
      safeAsyncCall(async () => {
        const books = await Reading.find({ userId: req.userId }).lean();
        
        return {
          overview: {
            total: books.length,
            completed: books.filter(b => b.status === 'completed').length,
            read: books.filter(b => b.status === 'completed').length, // alias for completed
            currentlyReading: books.filter(b => b.status === 'reading').length,
            toRead: books.filter(b => b.status === 'to_read').length,
            onHold: books.filter(b => b.status === 'on_hold').length
          }
        };
      }, { 
        overview: { total: 0, completed: 0, read: 0, currentlyReading: 0, toRead: 0, onHold: 0 } 
      }),

      // Skills data
      safeAsyncCall(async () => {
        const skills = await Skill.find({ userId: req.userId, archived: false }).lean();
        
        return {
          overview: {
            total: skills.length,
            mastered: skills.filter(s => s.status === 'mastered').length,
            learning: skills.filter(s => ['learning', 'practicing'].includes(s.status)).length,
            notStarted: skills.filter(s => s.status === 'not_started').length,
            onHold: skills.filter(s => s.status === 'on_hold').length
          }
        };
      }, { 
        overview: { total: 0, mastered: 0, learning: 0, notStarted: 0, onHold: 0 } 
      }),

      // Businesses data
      safeAsyncCall(async () => {
        const businesses = await Business.find({ 
          ownerId: req.userId,
          status: { $ne: 'closed' },
          archivedAt: { $exists: false }
        }).lean();
        
        return businesses.map(business => ({
          id: business._id,
          name: business.name,
          industry: business.industry,
          status: business.status,
          teamSize: business.teamMembers?.length || 1,
          stage: business.stage,
          updatedAt: business.updatedAt
        }));
      }, []),

      // Finances data
      safeAsyncCall(async () => {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const [incomes, expenses, budgets] = await Promise.all([
          Income.getTotalByUser(req.userId, startOfMonth, endOfMonth).catch(() => []),
          Expense.getTotalByUser(req.userId, startOfMonth, endOfMonth).catch(() => ({})),
          Budget.getTotals(req.userId).catch(() => ({}))
        ]);

        // Process income data
        const incomeTotal = Array.isArray(incomes) && incomes.length > 0 
          ? incomes[0].totalAmount || 0 
          : 0;

        // Process expense data
        const expenseTotal = expenses.GBP?.totalAmount || 0;

        // Process budget data
        const budgetData = budgets.GBP || {};

        return {
          income: incomeTotal,
          expenses: expenseTotal,
          savings: Math.max(0, incomeTotal - expenseTotal),
          budgeted: budgetData.totalBudgeted || 0,
          budgetSpent: budgetData.totalSpent || 0,
          budgetRemaining: budgetData.totalRemaining || 0
        };
      }, { 
        income: 0, 
        expenses: 0, 
        savings: 0,
        budgeted: 0,
        budgetSpent: 0,
        budgetRemaining: 0
      })
    ]);

    // Generate upcoming calendar events
    const upcomingEvents = generateUpcomingEvents(tasksData, projectsData);

    // Prepare comprehensive response
    const dashboardData = {
      // Overview statistics
      stats: {
        tasks: {
          total: tasksData.summary.total,
          completed: tasksData.summary.completed,
          pending: tasksData.summary.active + tasksData.summary.pending,
          overdue: tasksData.summary.overdue,
          dueToday: tasksData.summary.dueToday
        },
        projects: {
          total: projectsData.overview.totalProjects,
          active: projectsData.overview.activeProjects,
          completed: projectsData.overview.completedProjects,
          planning: projectsData.overview.planningProjects,
          overdue: projectsData.overview.overdueProjects
        },
        goals: {
          total: goalsData.overview.total,
          achieved: goalsData.overview.achieved,
          inProgress: goalsData.overview.inProgress,
          notStarted: goalsData.overview.notStarted
        },
        reading: {
          total: readingData.overview.total,
          read: readingData.overview.read,
          currentlyReading: readingData.overview.currentlyReading,
          toRead: readingData.overview.toRead
        },
        skills: {
          total: skillsData.overview.total,
          mastered: skillsData.overview.mastered,
          learning: skillsData.overview.learning,
          notStarted: skillsData.overview.notStarted
        },
        finances: {
          income: financesData.income,
          expenses: financesData.expenses,
          savings: financesData.savings,
          budgeted: financesData.budgeted,
          budgetSpent: financesData.budgetSpent,
          budgetRemaining: financesData.budgetRemaining
        }
      },

      // Businesses
      businesses: businessesData,

      // Calendar events
      upcomingEvents,

      // Categories for project distribution chart
      categories: projectsData.categories,

      // Recent activity
      recentProjects: projectsData.recentProjects,

      // Deadlines and overdue items
      upcomingDeadlines: projectsData.upcomingDeadlines,
      overdueProjects: projectsData.overdueProjects,
      upcomingTaskDeadlines: tasksData.upcomingDeadlines,

      // Meta information
      lastUpdated: new Date().toISOString(),
      dataFreshness: {
        tasks: tasksData.summary.total > 0 ? 'fresh' : 'empty',
        projects: projectsData.overview.totalProjects > 0 ? 'fresh' : 'empty',
        goals: goalsData.overview.total > 0 ? 'fresh' : 'empty',
        reading: readingData.overview.total > 0 ? 'fresh' : 'empty',
        skills: skillsData.overview.total > 0 ? 'fresh' : 'empty',
        businesses: businessesData.length > 0 ? 'fresh' : 'empty',
        finances: financesData.income > 0 || financesData.expenses > 0 ? 'fresh' : 'empty'
      }
    };

    console.log('✅ Dashboard data compiled successfully');
    
    res.json(dashboardData);

  } catch (error) {
    console.error('❌ Error fetching dashboard data:', error);
    
    // Return fallback data structure to prevent frontend crashes
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      stats: {
        tasks: { total: 0, completed: 0, pending: 0, overdue: 0, dueToday: 0 },
        projects: { total: 0, active: 0, completed: 0, planning: 0, overdue: 0 },
        goals: { total: 0, achieved: 0, inProgress: 0, notStarted: 0 },
        reading: { total: 0, read: 0, currentlyReading: 0, toRead: 0 },
        skills: { total: 0, mastered: 0, learning: 0, notStarted: 0 },
        finances: { income: 0, expenses: 0, savings: 0, budgeted: 0, budgetSpent: 0, budgetRemaining: 0 }
      },
      businesses: [],
      upcomingEvents: [],
      categories: [],
      recentProjects: [],
      upcomingDeadlines: [],
      overdueProjects: [],
      upcomingTaskDeadlines: [],
      lastUpdated: new Date().toISOString(),
      dataFreshness: {
        tasks: 'error',
        projects: 'error',
        goals: 'error',
        reading: 'error',
        skills: 'error',
        businesses: 'error',
        finances: 'error'
      }
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'home-dashboard'
  });
});

module.exports = router;