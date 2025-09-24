import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChartBarIcon,
  TrophyIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  PlusIcon,
  EyeIcon,
  XMarkIcon,
  CalendarIcon,
  FlagIcon,
  DocumentTextIcon,
  PlayIcon,
  ArrowLeftIcon,
  SparklesIcon,
  FireIcon,
  BoltIcon,
  FunnelIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

const Overview = () => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    overview: { total: 0, achieved: 0, inProgress: 0, overdue: 0 },
    upcomingDeadlines: [],
    topCategories: [],
    recentActivity: { goalsCreatedThisMonth: 0, goalsAchievedThisMonth: 0 }
  });
  const [recentGoals, setRecentGoals] = useState([]);
  const [milestonesHit, setMilestonesHit] = useState(0);

  // Modal states
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showStepModal, setShowStepModal] = useState(false);
  const [showAllGoalsModal, setShowAllGoalsModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [selectedStep, setSelectedStep] = useState(null);

  // All goals modal state
  const [allGoals, setAllGoals] = useState([]);
  const [filteredGoals, setFilteredGoals] = useState([]);
  const [allGoalsLoading, setAllGoalsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Get status info helper
  const getStatusInfo = (status) => {
    const statusInfo = {
      not_started: { color: 'gray', label: 'Not Started', icon: ClockIcon },
      in_progress: { color: 'blue', label: 'In Progress', icon: PlayIcon },
      achieved: { color: 'green', label: 'Achieved', icon: CheckCircleIcon }
    };
    return statusInfo[status] || statusInfo.not_started;
  };

  // Get priority info
  const getPriorityInfo = (priority) => {
    const priorityColors = {
      low: 'bg-gray-100 text-gray-600',
      medium: 'bg-blue-100 text-blue-600',
      high: 'bg-orange-100 text-orange-600',
      critical: 'bg-red-100 text-red-600'
    };
    return priorityColors[priority] || priorityColors.medium;
  };

  // Calculate total milestones hit across all goals
  const calculateMilestonesHit = (goals) => {
    let totalMilestones = 0;
    goals.forEach(goal => {
      if (goal.roadmap && goal.roadmap.length > 0) {
        totalMilestones += goal.roadmap.filter(step => step.completed).length;
      }
    });
    return totalMilestones;
  };

  // Load dashboard stats
  const loadStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const response = await fetch('http://localhost:5001/api/goals/stats/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        console.error('Failed to load stats');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading stats:', error);
      setLoading(false);
    }
  };

  // Load recent goals and calculate milestones
  const loadRecentGoals = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      // Load all goals to calculate total milestones hit
      const allGoalsResponse = await fetch('http://localhost:5001/api/goals?limit=1000', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (allGoalsResponse.ok) {
        const allGoalsData = await allGoalsResponse.json();
        const totalMilestones = calculateMilestonesHit(allGoalsData.goals || []);
        setMilestonesHit(totalMilestones);
      }

      // Load recent goals for display
      const recentResponse = await fetch('http://localhost:5001/api/goals?limit=8&sortBy=createdAt&sortOrder=desc', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (recentResponse.ok) {
        const recentData = await recentResponse.json();
        setRecentGoals(recentData.goals || []);
      }
    } catch (error) {
      console.error('Error loading recent goals:', error);
    }
  };

  // Load all goals for the modal
  const loadAllGoals = async () => {
    try {
      setAllGoalsLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch('http://localhost:5001/api/goals?limit=1000&sortBy=createdAt&sortOrder=desc', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAllGoals(data.goals || []);
        setFilteredGoals(data.goals || []);
      }
      setAllGoalsLoading(false);
    } catch (error) {
      console.error('Error loading all goals:', error);
      setAllGoalsLoading(false);
    }
  };

  // Filter goals based on search and filters
  const filterGoals = () => {
    let filtered = [...allGoals];

    // Search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(goal => 
        goal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        goal.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(goal => goal.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(goal => goal.category === categoryFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(goal => goal.priority === priorityFilter);
    }

    setFilteredGoals(filtered);
  };

  // Load specific goal details
  const loadGoalDetails = async (goalId) => {
    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`http://localhost:5001/api/goals/${goalId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const goalData = await response.json();
        setSelectedGoal(goalData);
        setShowGoalModal(true);
        // Close all goals modal when viewing specific goal
        setShowAllGoalsModal(false);
      } else {
        console.error('Failed to load goal details');
      }
    } catch (error) {
      console.error('Error loading goal details:', error);
    }
  };

  // Open step achievement modal
  const openStepModal = (step) => {
    setSelectedStep(step);
    setShowStepModal(true);
  };

  // Open all goals modal
  const openAllGoalsModal = () => {
    setShowAllGoalsModal(true);
    loadAllGoals();
  };

  // Calculate roadmap progress
  const calculateRoadmapProgress = (roadmap) => {
    if (!roadmap || roadmap.length === 0) return 0;
    const completed = roadmap.filter(step => step.completed).length;
    return Math.round((completed / roadmap.length) * 100);
  };

  // Get unique categories and priorities for filters
  const getUniqueCategories = () => {
    const categories = [...new Set(allGoals.map(goal => goal.category))];
    return categories.sort();
  };

  const getUniquePriorities = () => {
    const priorities = [...new Set(allGoals.map(goal => goal.priority))];
    return priorities.sort();
  };

  // Apply filters whenever dependencies change
  useEffect(() => {
    filterGoals();
  }, [searchTerm, statusFilter, categoryFilter, priorityFilter, allGoals]);

  useEffect(() => {
    loadStats();
    loadRecentGoals();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const completionRate = stats.overview.total > 0 
    ? ((stats.overview.achieved / stats.overview.total) * 100).toFixed(1)
    : 0;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <ChartBarIcon className="w-6 h-6 text-white" />
              </div>
              <ArrowTrendingUpIcon className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Goals</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.overview.total}</p>
            <div className="mt-3 text-sm text-gray-600">
              {stats.recentActivity.goalsCreatedThisMonth} created this month
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <TrophyIcon className="w-6 h-6 text-white" />
              </div>
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Achieved</h3>
            <p className="text-3xl font-bold text-green-600">{stats.overview.achieved}</p>
            <div className="mt-3 text-sm text-gray-600">
              {stats.recentActivity.goalsAchievedThisMonth} achieved this month
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                <ClockIcon className="w-6 h-6 text-white" />
              </div>
              <ArrowTrendingUpIcon className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">In Progress</h3>
            <p className="text-3xl font-bold text-orange-600">{stats.overview.inProgress}</p>
            <div className="mt-3 text-sm text-gray-600">
              Active goals
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <ExclamationTriangleIcon className="w-6 h-6 text-white" />
              </div>
              <ChartBarIcon className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Completion Rate</h3>
            <p className="text-3xl font-bold text-purple-600">{completionRate}%</p>
            <div className="mt-3 text-sm text-gray-600">
              {stats.overview.overdue} overdue goal{stats.overview.overdue !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Categories */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Categories</h3>
            <div className="space-y-4">
              {stats.topCategories.map((category, index) => (
                <div key={category.category} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      index === 0 ? 'bg-blue-500' : 
                      index === 1 ? 'bg-green-500' : 
                      index === 2 ? 'bg-orange-500' : 
                      'bg-gray-400'
                    }`}></div>
                    <span className="font-medium text-gray-900 capitalize">
                      {category.category}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          index === 0 ? 'bg-blue-500' : 
                          index === 1 ? 'bg-green-500' : 
                          index === 2 ? 'bg-orange-500' : 
                          'bg-gray-400'
                        }`}
                        style={{
                          width: `${(category.count / Math.max(...stats.topCategories.map(c => c.count))) * 100}%`
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-600 w-8 text-right">
                      {category.count}
                    </span>
                  </div>
                </div>
              ))}
              {stats.topCategories.length === 0 && (
                <p className="text-gray-500 text-center py-4">No categories yet</p>
              )}
            </div>
          </div>

          {/* Recent Goals - Clickable Cards */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Goals</h3>
              <button
                onClick={openAllGoalsModal}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All
              </button>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentGoals.map((goal) => {
                const statusInfo = getStatusInfo(goal.status);
                const StatusIcon = statusInfo.icon;
                const progress = calculateRoadmapProgress(goal.roadmap);
                
                return (
                  <div 
                    key={goal._id} 
                    onClick={() => loadGoalDetails(goal._id)}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <StatusIcon className={`w-4 h-4 text-${statusInfo.color}-500`} />
                        <h4 className="font-medium text-gray-900 text-sm truncate">{goal.title}</h4>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-full">
                          {goal.category}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full text-${statusInfo.color}-600 bg-${statusInfo.color}-100`}>
                          {statusInfo.label}
                        </span>
                        {goal.roadmap && goal.roadmap.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <div className="w-12 bg-gray-200 rounded-full h-1">
                              <div 
                                className={`h-1 bg-${statusInfo.color}-500 rounded-full`}
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500">{progress}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                      <EyeIcon className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              {recentGoals.length === 0 && (
                <div className="text-center py-8">
                  <TrophyIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No goals yet</p>
                  <button
                    onClick={() => navigate('/goals/set')}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Create your first goal
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Motivational Insights */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Your Goal Journey</h3>
            <SparklesIcon className="w-6 h-6" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <FlagIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold">Milestones Hit</h4>
                  <p className="text-sm opacity-90">Roadmap steps completed</p>
                </div>
              </div>
              <p className="text-2xl font-bold">{milestonesHit}</p>
            </div>

            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <BoltIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold">Monthly Progress</h4>
                  <p className="text-sm opacity-90">Goals achieved this month</p>
                </div>
              </div>
              <p className="text-2xl font-bold">{stats.recentActivity.goalsAchievedThisMonth}</p>
            </div>

            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <TrophyIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold">Success Rate</h4>
                  <p className="text-sm opacity-90">Overall completion rate</p>
                </div>
              </div>
              <p className="text-2xl font-bold">{completionRate}%</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/20">
            <div>
              <h4 className="font-semibold mb-1">Keep Going! 💪</h4>
              <p className="text-sm opacity-90">
                {milestonesHit > 0 
                  ? `Amazing! You've completed ${milestonesHit} milestone${milestonesHit !== 1 ? 's' : ''} across your goals. ${
                      stats.overview.inProgress > 0 
                        ? `${stats.overview.inProgress} goal${stats.overview.inProgress !== 1 ? 's' : ''} still in progress!`
                        : 'Ready for your next challenge?'
                    }`
                  : stats.overview.total > 0
                  ? "You have goals set up! Start completing roadmap steps to track your milestones."
                  : "Ready to start your goal journey? Create your first goal today!"
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* All Goals Modal */}
      {showAllGoalsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-gray-900">All Goals</h3>
                <button
                  onClick={() => setShowAllGoalsModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Search and Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="relative">
                  <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search goals..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="achieved">Achieved</option>
                </select>

                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Categories</option>
                  {getUniqueCategories().map(category => (
                    <option key={category} value={category} className="capitalize">
                      {category}
                    </option>
                  ))}
                </select>

                {/* Priority Filter */}
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Priorities</option>
                  {getUniquePriorities().map(priority => (
                    <option key={priority} value={priority} className="capitalize">
                      {priority}
                    </option>
                  ))}
                </select>
              </div>

              {/* Results count */}
              <div className="mt-4 text-sm text-gray-600">
                Showing {filteredGoals.length} of {allGoals.length} goals
              </div>
            </div>

            {/* Goals List */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {allGoalsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                </div>
              ) : filteredGoals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredGoals.map((goal) => {
                    const statusInfo = getStatusInfo(goal.status);
                    const StatusIcon = statusInfo.icon;
                    const progress = calculateRoadmapProgress(goal.roadmap);
                    
                    return (
                      <div
                        key={goal._id}
                        onClick={() => loadGoalDetails(goal._id)}
                        className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 cursor-pointer transition-colors border"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <StatusIcon className={`w-4 h-4 text-${statusInfo.color}-500`} />
                            <span className={`text-xs px-2 py-1 rounded-full text-${statusInfo.color}-600 bg-${statusInfo.color}-100`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${getPriorityInfo(goal.priority)}`}>
                            {goal.priority}
                          </span>
                        </div>
                        
                        <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                          {goal.title}
                        </h4>
                        
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {goal.description}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-full">
                            {goal.category}
                          </span>
                          
                          {goal.roadmap && goal.roadmap.length > 0 && (
                            <div className="flex items-center space-x-2">
                              <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className={`h-1.5 bg-${statusInfo.color}-500 rounded-full`}
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                              <span className="text-xs text-gray-500">{progress}%</span>
                            </div>
                          )}
                        </div>
                        
                        {goal.targetDate && (
                          <div className="mt-2 text-xs text-gray-500 flex items-center">
                            <CalendarIcon className="w-3 h-3 mr-1" />
                            Due: {new Date(goal.targetDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-20">
                  <TrophyIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No goals found</h4>
                  <p className="text-gray-500">
                    {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' || priorityFilter !== 'all'
                      ? 'Try adjusting your filters or search term.'
                      : 'Create your first goal to get started!'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Goal Details Modal */}
      {showGoalModal && selectedGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Goal Details</h3>
                <button
                  onClick={() => { setShowGoalModal(false); setSelectedGoal(null); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Goal Info */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xl font-semibold text-gray-900 mb-2">{selectedGoal.title}</h4>
                    <p className="text-gray-600 mb-4">{selectedGoal.description}</p>
                    
                    <div className="flex flex-wrap gap-3 mb-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityInfo(selectedGoal.priority)}`}>
                        {selectedGoal.priority} priority
                      </span>
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                        {selectedGoal.category}
                      </span>
                      {(() => {
                        const statusInfo = getStatusInfo(selectedGoal.status);
                        return (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium text-${statusInfo.color}-600 bg-${statusInfo.color}-100`}>
                            {statusInfo.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {selectedGoal.targetDate && (
                    <div className="flex items-center space-x-2 text-gray-600">
                      <CalendarIcon className="w-5 h-5" />
                      <span>Target Date: {new Date(selectedGoal.targetDate).toLocaleDateString()}</span>
                    </div>
                  )}

                  {selectedGoal.tags && selectedGoal.tags.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-2 block">Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {selectedGoal.tags.map(tag => (
                          <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Created</label>
                      <p className="text-gray-900">{new Date(selectedGoal.createdAt).toLocaleDateString()}</p>
                    </div>
                    {selectedGoal.achievedAt && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Achieved</label>
                        <p className="text-gray-900">{new Date(selectedGoal.achievedAt).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Roadmap */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="text-lg font-semibold text-gray-900">Roadmap</h5>
                    {selectedGoal.roadmap && selectedGoal.roadmap.length > 0 && (
                      <div className="text-right">
                        <div className="text-xl font-bold text-blue-600">
                          {calculateRoadmapProgress(selectedGoal.roadmap)}%
                        </div>
                        <div className="text-sm text-gray-500">Complete</div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {selectedGoal.roadmap && selectedGoal.roadmap.length > 0 ? (
                      selectedGoal.roadmap.map((step, index) => (
                        <div
                          key={index}
                          className={`p-4 border rounded-lg transition-colors ${
                            step.completed 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                              <div className="mt-0.5">
                                {step.completed ? (
                                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                ) : (
                                  <ClockIcon className="w-5 h-5 text-gray-400" />
                                )}
                              </div>
                              <div className="flex-1">
                                <h6 className={`font-medium text-sm ${step.completed ? 'text-green-900 line-through' : 'text-gray-900'}`}>
                                  {step.step}
                                </h6>
                                {step.completedAt && (
                                  <p className="mt-1 text-xs text-green-600">
                                    Completed on {new Date(step.completedAt).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>
                            {step.completed && step.description && (
                              <button
                                onClick={() => openStepModal(step)}
                                className="ml-3 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="View achievement details"
                              >
                                <DocumentTextIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <FlagIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">No roadmap steps defined</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                  onClick={() => { setShowGoalModal(false); setSelectedGoal(null); }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step Achievement Details Modal */}
      {showStepModal && selectedStep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Step Achievement</h3>
                <button
                  onClick={() => { setShowStepModal(false); setSelectedStep(null); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    <h4 className="font-medium text-green-900">Completed Step</h4>
                  </div>
                  <p className="text-green-800 font-medium">{selectedStep.step}</p>
                  {selectedStep.completedAt && (
                    <p className="text-sm text-green-600 mt-1">
                      Completed on {new Date(selectedStep.completedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {selectedStep.description && (
                  <div>
                    <h5 className="text-lg font-medium text-gray-900 mb-3">How it was achieved:</h5>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {selectedStep.description}
                      </p>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      {selectedStep.description.trim().split(/\s+/).length} words
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                  onClick={() => { setShowStepModal(false); setSelectedStep(null); }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Overview;