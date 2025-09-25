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
  PauseIcon,
  SparklesIcon,
  BoltIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  CubeIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';

const Overview = () => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    overview: { totalProjects: 0, activeProjects: 0, completedProjects: 0, overdueProjects: 0, avgCompletion: 0 },
    upcomingDeadlines: [],
    categories: [],
    recentProjects: []
  });
  const [recentProjects, setRecentProjects] = useState([]);
  const [milestonesCompleted, setMilestonesCompleted] = useState(0);

  // Modal states
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showAllProjectsModal, setShowAllProjectsModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedMilestone, setSelectedMilestone] = useState(null);

  // All projects modal state
  const [allProjects, setAllProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [allProjectsLoading, setAllProjectsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Get status info helper
  const getStatusInfo = (status) => {
    const statusInfo = {
      planning: { color: 'gray', label: 'Planning', icon: ClipboardDocumentListIcon },
      active: { color: 'blue', label: 'Active', icon: PlayIcon },
      on_hold: { color: 'yellow', label: 'On Hold', icon: PauseIcon },
      completed: { color: 'green', label: 'Completed', icon: CheckCircleIcon },
      cancelled: { color: 'red', label: 'Cancelled', icon: XMarkIcon }
    };
    return statusInfo[status] || statusInfo.planning;
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

  // Calculate total milestones completed across all projects
  const calculateMilestonesCompleted = (projects) => {
    let totalMilestones = 0;
    projects.forEach(project => {
      if (project.milestones && project.milestones.length > 0) {
        totalMilestones += project.milestones.filter(milestone => milestone.completed).length;
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

      const response = await fetch('http://localhost:5001/api/projects/stats/dashboard', {
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

  // Load recent projects and calculate milestones
  const loadRecentProjects = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      // Load all projects to calculate total milestones completed
      const allProjectsResponse = await fetch('http://localhost:5001/api/projects?limit=1000', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (allProjectsResponse.ok) {
        const allProjectsData = await allProjectsResponse.json();
        const totalMilestones = calculateMilestonesCompleted(allProjectsData.projects || []);
        setMilestonesCompleted(totalMilestones);
      }

      // Load recent projects for display
      const recentResponse = await fetch('http://localhost:5001/api/projects?limit=8&sortBy=updatedAt&sortOrder=desc', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (recentResponse.ok) {
        const recentData = await recentResponse.json();
        setRecentProjects(recentData.projects || []);
      }
    } catch (error) {
      console.error('Error loading recent projects:', error);
    }
  };

  // Load all projects for the modal
  const loadAllProjects = async () => {
    try {
      setAllProjectsLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch('http://localhost:5001/api/projects?limit=1000&sortBy=updatedAt&sortOrder=desc', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAllProjects(data.projects || []);
        setFilteredProjects(data.projects || []);
      }
      setAllProjectsLoading(false);
    } catch (error) {
      console.error('Error loading all projects:', error);
      setAllProjectsLoading(false);
    }
  };

  // Filter projects based on search and filters
  const filterProjects = () => {
    let filtered = [...allProjects];

    // Search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(project => 
        project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(project => project.category === categoryFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(project => project.priority === priorityFilter);
    }

    setFilteredProjects(filtered);
  };

  // Load specific project details
  const loadProjectDetails = async (projectId) => {
    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`http://localhost:5001/api/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const projectData = await response.json();
        setSelectedProject(projectData);
        setShowProjectModal(true);
        // Close all projects modal when viewing specific project
        setShowAllProjectsModal(false);
      } else {
        console.error('Failed to load project details');
      }
    } catch (error) {
      console.error('Error loading project details:', error);
    }
  };

  // Open milestone modal
  const openMilestoneModal = (milestone) => {
    setSelectedMilestone(milestone);
    setShowMilestoneModal(true);
  };

  // Open all projects modal
  const openAllProjectsModal = () => {
    setShowAllProjectsModal(true);
    loadAllProjects();
  };

  // Get unique categories and priorities for filters
  const getUniqueCategories = () => {
    const categories = [...new Set(allProjects.map(project => project.category))];
    return categories.sort();
  };

  const getUniquePriorities = () => {
    const priorities = [...new Set(allProjects.map(project => project.priority))];
    return priorities.sort();
  };

  // Apply filters whenever dependencies change
  useEffect(() => {
    filterProjects();
  }, [searchTerm, statusFilter, categoryFilter, priorityFilter, allProjects]);

  useEffect(() => {
    loadStats();
    loadRecentProjects();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <CubeIcon className="w-6 h-6 text-white" />
              </div>
              <ArrowTrendingUpIcon className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Projects</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.overview.totalProjects}</p>
            <div className="mt-3 text-sm text-gray-600">
              All project initiatives
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6 text-white" />
              </div>
              <TrophyIcon className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Completed</h3>
            <p className="text-3xl font-bold text-green-600">{stats.overview.completedProjects}</p>
            <div className="mt-3 text-sm text-gray-600">
              Successfully finished
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                <PlayIcon className="w-6 h-6 text-white" />
              </div>
              <ArrowTrendingUpIcon className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Active</h3>
            <p className="text-3xl font-bold text-orange-600">{stats.overview.activeProjects}</p>
            <div className="mt-3 text-sm text-gray-600">
              Currently in progress
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <ChartBarIcon className="w-6 h-6 text-white" />
              </div>
              <BoltIcon className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Avg Progress</h3>
            <p className="text-3xl font-bold text-purple-600">{stats.overview.avgCompletion}%</p>
            <div className="mt-3 text-sm text-gray-600">
              {stats.overview.overdueProjects} overdue project{stats.overview.overdueProjects !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Categories */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Categories</h3>
            <div className="space-y-4">
              {stats.categories?.map((category, index) => (
                <div key={category.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      index === 0 ? 'bg-blue-500' : 
                      index === 1 ? 'bg-green-500' : 
                      index === 2 ? 'bg-orange-500' : 
                      'bg-gray-400'
                    }`}></div>
                    <span className="font-medium text-gray-900 capitalize">
                      {category.name}
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
                          width: `${stats.categories.length > 0 ? (category.count / Math.max(...stats.categories.map(c => c.count))) * 100 : 0}%`
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-600 w-8 text-right">
                      {category.count}
                    </span>
                  </div>
                </div>
              ))}
              {(!stats.categories || stats.categories.length === 0) && (
                <p className="text-gray-500 text-center py-4">No project categories yet</p>
              )}
            </div>
          </div>

          {/* Recent Projects - Clickable Cards */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Projects</h3>
              <button
                onClick={openAllProjectsModal}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All
              </button>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentProjects.map((project) => {
                const statusInfo = getStatusInfo(project.status);
                const StatusIcon = statusInfo.icon;
                const progress = project.progress || project.completionPercentage || 0;
                
                return (
                  <div 
                    key={project._id} 
                    onClick={() => loadProjectDetails(project._id)}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <StatusIcon className={`w-4 h-4 text-${statusInfo.color}-500`} />
                        <h4 className="font-medium text-gray-900 text-sm truncate">{project.title}</h4>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-full">
                          {project.category}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full text-${statusInfo.color}-600 bg-${statusInfo.color}-100`}>
                          {statusInfo.label}
                        </span>
                        <div className="flex items-center space-x-1">
                          <div className="w-12 bg-gray-200 rounded-full h-1">
                            <div 
                              className={`h-1 bg-${statusInfo.color}-500 rounded-full`}
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500">{progress}%</span>
                        </div>
                      </div>
                    </div>
                    <button className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                      <EyeIcon className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              {recentProjects.length === 0 && (
                <div className="text-center py-8">
                  <CubeIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No projects yet</p>
                  <button
                    onClick={() => navigate('/projects/create')}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Create your first project
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Project Journey */}
        <div className="bg-gradient-to-r from-purple-500 to-blue-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Your Project Journey</h3>
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
                  <p className="text-sm opacity-90">Project milestones completed</p>
                </div>
              </div>
              <p className="text-2xl font-bold">{milestonesCompleted}</p>
            </div>

            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <BoltIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold">Active Projects</h4>
                  <p className="text-sm opacity-90">Currently in progress</p>
                </div>
              </div>
              <p className="text-2xl font-bold">{stats.overview.activeProjects}</p>
            </div>

            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <TrophyIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold">Success Rate</h4>
                  <p className="text-sm opacity-90">Project completion average</p>
                </div>
              </div>
              <p className="text-2xl font-bold">{stats.overview.avgCompletion}%</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/20">
            <div>
              <h4 className="font-semibold mb-1">Keep Building! 🚀</h4>
              <p className="text-sm opacity-90">
                {milestonesCompleted > 0 
                  ? `Excellent! You've completed ${milestonesCompleted} milestone${milestonesCompleted !== 1 ? 's' : ''} across your projects. ${
                      stats.overview.activeProjects > 0 
                        ? `${stats.overview.activeProjects} project${stats.overview.activeProjects !== 1 ? 's' : ''} still active!`
                        : 'Ready for your next big project?'
                    }`
                  : stats.overview.totalProjects > 0
                  ? "You have projects in progress! Start hitting those milestones to track your progress."
                  : "Ready to start building? Create your first project today!"
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* All Projects Modal */}
      {showAllProjectsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-gray-900">All Projects</h3>
                <button
                  onClick={() => setShowAllProjectsModal(false)}
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
                    placeholder="Search projects..."
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
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
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
                Showing {filteredProjects.length} of {allProjects.length} projects
              </div>
            </div>

            {/* Projects List */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {allProjectsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                </div>
              ) : filteredProjects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProjects.map((project) => {
                    const statusInfo = getStatusInfo(project.status);
                    const StatusIcon = statusInfo.icon;
                    const progress = project.progress || project.completionPercentage || 0;
                    
                    return (
                      <div
                        key={project._id}
                        onClick={() => loadProjectDetails(project._id)}
                        className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 cursor-pointer transition-colors border"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <StatusIcon className={`w-4 h-4 text-${statusInfo.color}-500`} />
                            <span className={`text-xs px-2 py-1 rounded-full text-${statusInfo.color}-600 bg-${statusInfo.color}-100`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${getPriorityInfo(project.priority)}`}>
                            {project.priority}
                          </span>
                        </div>
                        
                        <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                          {project.title}
                        </h4>
                        
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {project.description}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-full">
                            {project.category}
                          </span>
                          
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-gray-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 bg-${statusInfo.color}-500 rounded-full`}
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500">{progress}%</span>
                          </div>
                        </div>
                        
                        {project.endDate && (
                          <div className="mt-2 text-xs text-gray-500 flex items-center">
                            <CalendarIcon className="w-3 h-3 mr-1" />
                            Due: {new Date(project.endDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-20">
                  <CubeIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No projects found</h4>
                  <p className="text-gray-500">
                    {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' || priorityFilter !== 'all'
                      ? 'Try adjusting your filters or search term.'
                      : 'Create your first project to get started!'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Project Details Modal */}
      {showProjectModal && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Project Details</h3>
                <button
                  onClick={() => { setShowProjectModal(false); setSelectedProject(null); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Project Info */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xl font-semibold text-gray-900 mb-2">{selectedProject.title}</h4>
                    <p className="text-gray-600 mb-4">{selectedProject.description}</p>
                    
                    <div className="flex flex-wrap gap-3 mb-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityInfo(selectedProject.priority)}`}>
                        {selectedProject.priority} priority
                      </span>
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                        {selectedProject.category}
                      </span>
                      {(() => {
                        const statusInfo = getStatusInfo(selectedProject.status);
                        return (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium text-${statusInfo.color}-600 bg-${statusInfo.color}-100`}>
                            {statusInfo.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {selectedProject.endDate && (
                    <div className="flex items-center space-x-2 text-gray-600">
                      <CalendarIcon className="w-5 h-5" />
                      <span>Target Date: {new Date(selectedProject.endDate).toLocaleDateString()}</span>
                    </div>
                  )}

                  {selectedProject.tags && selectedProject.tags.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-2 block">Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {selectedProject.tags.map(tag => (
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
                      <p className="text-gray-900">{new Date(selectedProject.createdAt).toLocaleDateString()}</p>
                    </div>
                    {selectedProject.actualCompletionDate && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Completed</label>
                        <p className="text-gray-900">{new Date(selectedProject.actualCompletionDate).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Milestones */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="text-lg font-semibold text-gray-900">Milestones</h5>
                    {selectedProject.milestones && selectedProject.milestones.length > 0 && (
                      <div className="text-right">
                        <div className="text-xl font-bold text-blue-600">
                          {Math.round((selectedProject.milestones.filter(m => m.completed).length / selectedProject.milestones.length) * 100)}%
                        </div>
                        <div className="text-sm text-gray-500">Complete</div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {selectedProject.milestones && selectedProject.milestones.length > 0 ? (
                      selectedProject.milestones.map((milestone, index) => (
                        <div
                          key={index}
                          className={`p-4 border rounded-lg transition-colors ${
                            milestone.completed 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                              <div className="mt-0.5">
                                {milestone.completed ? (
                                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                ) : (
                                  <ClockIcon className="w-5 h-5 text-gray-400" />
                                )}
                              </div>
                              <div className="flex-1">
                                <h6 className={`font-medium text-sm ${milestone.completed ? 'text-green-900 line-through' : 'text-gray-900'}`}>
                                  {milestone.title}
                                </h6>
                                {milestone.completedAt && (
                                  <p className="mt-1 text-xs text-green-600">
                                    Completed on {new Date(milestone.completedAt).toLocaleDateString()}
                                  </p>
                                )}
                                {milestone.dueDate && (
                                  <p className="mt-1 text-xs text-gray-500">
                                    Due: {new Date(milestone.dueDate).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>
                            {milestone.completed && milestone.notes && milestone.notes.length > 0 && (
                              <button
                                onClick={() => openMilestoneModal(milestone)}
                                className="ml-3 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="View milestone details"
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
                        <p className="text-gray-500">No milestones defined</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                  onClick={() => { setShowProjectModal(false); setSelectedProject(null); }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Milestone Details Modal */}
      {showMilestoneModal && selectedMilestone && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Milestone Details</h3>
                <button
                  onClick={() => { setShowMilestoneModal(false); setSelectedMilestone(null); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    <h4 className="font-medium text-green-900">Completed Milestone</h4>
                  </div>
                  <p className="text-green-800 font-medium">{selectedMilestone.title}</p>
                  {selectedMilestone.completedAt && (
                    <p className="text-sm text-green-600 mt-1">
                      Completed on {new Date(selectedMilestone.completedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {selectedMilestone.description && (
                  <div>
                    <h5 className="text-lg font-medium text-gray-900 mb-3">Description:</h5>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {selectedMilestone.description}
                      </p>
                    </div>
                  </div>
                )}

                {selectedMilestone.notes && selectedMilestone.notes.length > 0 && (
                  <div>
                    <h5 className="text-lg font-medium text-gray-900 mb-3">Notes:</h5>
                    <div className="space-y-2">
                      {selectedMilestone.notes.map((note, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-gray-700 text-sm">{note.content}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(note.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                  onClick={() => { setShowMilestoneModal(false); setSelectedMilestone(null); }}
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