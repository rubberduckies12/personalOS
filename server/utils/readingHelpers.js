const Reading = require('../models/readingModel');

// Progress calculation helper
const calculateReadingProgress = (currentPage, totalPages) => {
  if (!totalPages || totalPages === 0) return 0;
  return Math.round((currentPage / totalPages) * 100);
};

// Time estimation helper
const estimateReadingTime = (currentPage, totalPages, averagePageTime = 3) => {
  if (!totalPages || currentPage >= totalPages) return 0;
  const remainingPages = totalPages - currentPage;
  return Math.round(remainingPages * averagePageTime);
};

// Reading velocity calculation
const calculateReadingVelocity = (reading) => {
  if (!reading.startedAt || reading.currentPage <= 0) return 0;
  const daysReading = Math.ceil((new Date() - new Date(reading.startedAt)) / (1000 * 60 * 60 * 24));
  return daysReading > 0 ? Math.round(reading.currentPage / daysReading * 10) / 10 : 0;
};

// Check if reading item is overdue
const isOverdue = (reading) => {
  return reading.targetDate && 
         new Date(reading.targetDate) < new Date() && 
         reading.status !== 'completed';
};

// Enhanced reading stats calculation
const calculateReadingStats = (readings, userConfig = {}) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  
  // Filter for books only (not articles or other reading types)
  const books = readings.filter(r => r.type === 'book' || !r.type);
  const completedBooks = books.filter(r => r.status === 'completed');
  
  // Calculate yearly progress based on user goal
  const yearlyGoal = userConfig.yearlyReadingGoal || 52;
  const currentProgress = completedBooks.filter(r => {
    const completedAt = r.completedAt || r.updatedAt;
    return completedAt && new Date(completedAt).getFullYear() === currentYear;
  }).length;
  
  return {
    total: readings.length,
    totalBooks: books.length,
    booksRead: completedBooks.length,
    completed: readings.filter(r => r.status === 'completed').length,
    currentlyReading: readings.filter(r => r.status === 'reading').length,
    toRead: readings.filter(r => r.status === 'to_read').length,
    onHold: readings.filter(r => r.status === 'on_hold').length,
    thisYear: readings.filter(r => {
      const completedAt = r.completedAt || r.updatedAt;
      return completedAt && new Date(completedAt).getFullYear() === currentYear;
    }).length,
    booksThisYear: currentProgress,
    thisMonth: readings.filter(r => {
      const completedAt = r.completedAt || r.updatedAt;
      return completedAt && 
             new Date(completedAt).getFullYear() === currentYear &&
             new Date(completedAt).getMonth() === currentMonth;
    }).length,
    booksThisMonth: completedBooks.filter(r => {
      const completedAt = r.completedAt || r.updatedAt;
      return completedAt && 
             new Date(completedAt).getFullYear() === currentYear &&
             new Date(completedAt).getMonth() === currentMonth;
    }).length,
    totalPages: readings.reduce((sum, r) => sum + (r.totalPages || 0), 0),
    pagesRead: readings.reduce((sum, r) => sum + (r.currentPage || 0), 0),
    bookPagesRead: books.reduce((sum, r) => sum + (r.currentPage || 0), 0),
    avgBooksPerMonth: currentMonth > 0 ? Math.round((currentProgress / (currentMonth + 1)) * 10) / 10 : 0,
    goalProgress: {
      target: yearlyGoal,
      current: currentProgress,
      expected: Math.round((yearlyGoal / 12) * (currentMonth + 1)),
      percentageComplete: Math.round((currentProgress / yearlyGoal) * 100),
      onTrack: currentProgress >= Math.round((yearlyGoal / 12) * (currentMonth + 1)),
      projectedTotal: Math.round((currentProgress / (currentMonth + 1)) * 12)
    }
  };
};

// Enhanced reading item with calculated fields
const enhanceReadingItem = (reading, userConfig = {}) => {
  const progress = calculateReadingProgress(reading.currentPage, reading.totalPages);
  const estimatedTimeRemaining = estimateReadingTime(
    reading.currentPage, 
    reading.totalPages, 
    reading.averagePageTime || userConfig.defaultPageTime || 3
  );
  const readingVelocity = calculateReadingVelocity(reading);
  
  return {
    ...reading,
    progress,
    estimatedTimeRemaining,
    readingVelocity,
    isOverdue: isOverdue(reading)
  };
};

// Optimized aggregation pipelines for performance
const getOptimizedGenreTrends = (userId, timeframe = '12months') => {
  let startDate;
  switch (timeframe) {
    case '3months':
      startDate = new Date(new Date().setMonth(new Date().getMonth() - 3));
      break;
    case '6months':
      startDate = new Date(new Date().setMonth(new Date().getMonth() - 6));
      break;
    case '12months':
      startDate = new Date(new Date().setMonth(new Date().getMonth() - 12));
      break;
    case '2years':
      startDate = new Date(new Date().setFullYear(new Date().getFullYear() - 2));
      break;
    default:
      startDate = new Date(new Date().setMonth(new Date().getMonth() - 12));
  }

  return Reading.aggregate([
    {
      $match: {
        userId: userId,
        status: 'completed',
        completedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          genre: { $ifNull: ['$genre', 'Uncategorized'] },
          year: { $year: '$completedAt' },
          month: { $month: '$completedAt' }
        },
        count: { $sum: 1 },
        totalPages: { $sum: { $ifNull: ['$totalPages', 0] } },
        avgRating: { $avg: { $ifNull: ['$rating', 0] } }
      }
    },
    {
      $group: {
        _id: '$_id.genre',
        monthlyData: {
          $push: {
            year: '$_id.year',
            month: '$_id.month',
            count: '$count',
            totalPages: '$totalPages',
            avgRating: '$avgRating'
          }
        },
        totalCount: { $sum: '$count' },
        totalPages: { $sum: '$totalPages' }
      }
    },
    { $sort: { totalCount: -1 } }
  ]);
};

// Optimized heatmap data with better performance
const getOptimizedHeatmapData = (userId, year) => {
  const targetYear = parseInt(year);
  
  return Reading.aggregate([
    {
      $match: {
        userId: userId,
        sessions: { $exists: true, $ne: [] }
      }
    },
    { $unwind: '$sessions' },
    {
      $match: {
        'sessions.date': {
          $gte: new Date(targetYear, 0, 1),
          $lt: new Date(targetYear + 1, 0, 1)
        }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$sessions.date'
          }
        },
        totalDuration: { $sum: '$sessions.duration' },
        totalPages: { $sum: '$sessions.pagesRead' },
        sessionCount: { $sum: 1 },
        uniqueBooks: { $addToSet: '$_id' }
      }
    },
    {
      $addFields: {
        intensity: {
          $min: [4, { $floor: { $divide: ['$totalDuration', 30] } }]
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Monthly breakdown for current year with performance optimization
const getCurrentYearBreakdown = (userId) => {
  const currentYear = new Date().getFullYear();
  
  return Reading.aggregate([
    {
      $match: {
        userId: userId,
        status: 'completed',
        completedAt: {
          $gte: new Date(currentYear, 0, 1),
          $lt: new Date(currentYear + 1, 0, 1)
        }
      }
    },
    {
      $group: {
        _id: { $month: '$completedAt' },
        books: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$type', 'book'] }, 'book'] }, 1, 0] } },
        articles: { $sum: { $cond: [{ $eq: ['$type', 'article'] }, 1, 0] } },
        audiobooks: { $sum: { $cond: [{ $eq: ['$type', 'audiobook'] }, 1, 0] } },
        other: { $sum: { $cond: [{ $nin: [{ $ifNull: ['$type', 'book'] }, ['book', 'article', 'audiobook']] }, 1, 0] } },
        totalPages: { $sum: { $ifNull: ['$totalPages', 0] } },
        avgRating: { $avg: { $ifNull: ['$rating', 0] } },
        totalCount: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

module.exports = {
  calculateReadingProgress,
  estimateReadingTime,
  calculateReadingVelocity,
  isOverdue,
  calculateReadingStats,
  enhanceReadingItem,
  getOptimizedGenreTrends,
  getOptimizedHeatmapData,
  getCurrentYearBreakdown
};