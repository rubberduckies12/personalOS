import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CheckCircleIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  BookOpenIcon,
  CurrencyDollarIcon,
  AcademicCapIcon,
  FolderIcon,
  CalendarDaysIcon,
  SparklesIcon,
  EyeIcon,
  PencilIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  BuildingOffice2Icon,
  PlusIcon,
  ArrowRightIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    tasks: { total: 0, completed: 0, pending: 0 },
    projects: { total: 0, active: 0, completed: 0 },
    goals: { total: 0, achieved: 0, inProgress: 0 },
    reading: { total: 0, read: 0, currentlyReading: 0 },
    skills: { total: 0, mastered: 0, learning: 0 },
    finances: { income: 0, expenses: 0, savings: 0 }
  });
  const [businesses, setBusinesses] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [authError, setAuthError] = useState(false);

  // Get welcome message from login redirect
  const welcomeMessage = location.state?.message;

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (string) => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  };

  // Simplified authentication check - don't make API calls for auth verification
  const checkAuth = async () => {
    try {
      console.log('🔍 Checking authentication...');
      
      // Get user data from localStorage
      const userData = localStorage.getItem('user');
      if (!userData) {
        console.log('❌ No user data in localStorage');
        navigate('/auth/login', { 
          state: { message: 'Please log in to continue' }
        });
        return false;
      }

      setUser(JSON.parse(userData));
      console.log('✅ Authentication successful - user data found');
      return true;

    } catch (error) {
      console.error('🚨 Auth check error:', error);
      // On error, don't redirect - just continue
      return true;
    }
  };

  // Logout function
  const handleLogout = async () => {
    try {
      // Clear local storage
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      
      // Make logout request to clear HTTP cookies
      await fetch('http://localhost:5001/api/auth/logout', {
        method: 'POST',
        credentials: 'include' // Include cookies
      });
      
      // Redirect to login
      navigate('/auth/login', { 
        state: { message: 'You have been logged out successfully' }
      });
    } catch (error) {
      console.error('Error during logout:', error);
      // Still redirect even if logout request fails
      navigate('/auth/login');
    }
  };

  // Generate upcoming calendar events from tasks and projects
  const generateUpcomingEvents = (tasksData, projectsData) => {
    const events = [];
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Add task due dates
    if (tasksData && tasksData.upcomingDeadlines) {
      tasksData.upcomingDeadlines.forEach(task => {
        events.push({
          id: `task-${task.id}`,
          type: 'task',
          title: task.title,
          date: new Date(task.dueDate),
          color: 'blue',
          icon: ClipboardDocumentListIcon
        });
      });
    }

    // Add project milestones
    if (projectsData && projectsData.upcomingDeadlines) {
      projectsData.upcomingDeadlines.forEach(project => {
        events.push({
          id: `project-${project.id}`,
          type: 'project',
          title: `${project.title} deadline`,
          date: new Date(project.targetCompletionDate),
          color: 'purple',
          icon: FolderIcon
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

  useEffect(() => {
    loadDashboardData();
  }, [navigate, welcomeMessage]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setAuthError(false);

      console.log('📊 Starting dashboard data load...');

      // Simple auth check - just verify localStorage
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) {
        console.log('❌ Authentication failed, stopping data load');
        setLoading(false);
        return;
      }

      console.log('🔄 Fetching real dashboard data from APIs...');

      // Fetch options for all API calls
      const fetchOptions = {
        method: 'GET',
        credentials: 'include', // This sends cookies for authentication
        headers: {
          'Content-Type': 'application/json'
        }
      };

      // Helper function to safely fetch data with fallbacks
      const fetchWithFallback = async (url, fallbackData) => {
        try {
          console.log(`🌐 Fetching: ${url}`);
          const response = await fetch(url, fetchOptions);
          
          if (response.status === 401) {
            console.log('🔒 401 Unauthorized - redirecting to login');
            localStorage.removeItem('user');
            navigate('/auth/login', { 
              state: { message: 'Your session has expired. Please log in again.' }
            });
            return null;
          }
          
          if (response.ok) {
            const data = await response.json();
            console.log(`✅ Success fetching ${url}:`, data);
            return data;
          } else {
            console.warn(`⚠️ Failed to fetch ${url}: ${response.status} ${response.statusText}`);
            return fallbackData;
          }
        } catch (error) {
          console.warn(`⚠️ Network error fetching ${url}:`, error.message);
          return fallbackData;
        }
      };

      // Fetch data from all endpoints
      const [
        tasksData,
        projectsData,
        goalsData,
        readingData,
        skillsData,
        financesData,
        businessesData
      ] = await Promise.all([
        fetchWithFallback(
          'http://localhost:5001/api/tasks/analytics/overview',
          { summary: { total: 0, completed: 0, active: 0, pending: 0 }, upcomingDeadlines: [] }
        ),
        fetchWithFallback(
          'http://localhost:5001/api/projects/stats/dashboard',
          { overview: { totalProjects: 0, activeProjects: 0, completedProjects: 0 }, upcomingDeadlines: [] }
        ),
        fetchWithFallback(
          'http://localhost:5001/api/goals/stats/dashboard',
          { overview: { total: 0, achieved: 0, inProgress: 0 } }
        ),
        fetchWithFallback(
          'http://localhost:5001/api/reading/stats/dashboard',
          { overview: { total: 0, completed: 0, read: 0, currentlyReading: 0 } }
        ),
        fetchWithFallback(
          'http://localhost:5001/api/skills/analytics/overview',
          { overview: { total: 0, mastered: 0, learning: 0 } }
        ),
        fetchWithFallback(
          'http://localhost:5001/api/finances/budgets?limit=1',
          { summary: { income: 0, expenses: 0, savings: 0 } }
        ),
        fetchWithFallback(
          'http://localhost:5001/api/businesses?limit=3&status=active',
          []
        )
      ]);

      // If any call returned null (401 error), stop processing
      if (!tasksData || !projectsData || !goalsData || !readingData || !skillsData || !financesData) {
        console.log('❌ Authentication failed during API calls');
        setLoading(false);
        return;
      }

      console.log('📊 Processing API data...');

      // Update stats with real data
      setStats({
        tasks: {
          total: tasksData.summary?.total || 0,
          completed: tasksData.summary?.completed || 0,
          pending: tasksData.summary?.active || tasksData.summary?.pending || 0
        },
        projects: {
          total: projectsData.overview?.totalProjects || 0,
          active: projectsData.overview?.activeProjects || 0,
          completed: projectsData.overview?.completedProjects || 0
        },
        goals: {
          total: goalsData.overview?.total || 0,
          achieved: goalsData.overview?.achieved || 0,
          inProgress: goalsData.overview?.inProgress || 0
        },
        reading: {
          total: readingData.overview?.total || 0,
          read: readingData.overview?.completed || readingData.overview?.read || 0,
          currentlyReading: readingData.overview?.currentlyReading || 0
        },
        skills: {
          total: skillsData.overview?.total || 0,
          mastered: skillsData.overview?.mastered || 0,
          learning: skillsData.overview?.learning || 0
        },
        finances: {
          income: financesData.summary?.income || financesData.income || 0,
          expenses: financesData.summary?.expenses || financesData.expenses || 0,
          savings: financesData.summary?.savings || financesData.savings || 0
        }
      });

      // Process businesses data
      if (businessesData && Array.isArray(businessesData)) {
        setBusinesses(
          businessesData.map(business => ({
            id: business._id || business.id,
            name: business.name,
            industry: business.industry,
            status: business.status,
            teamSize: business.teamMemberCount || business.teamMembers?.length || 1,
            stage: business.stage,
            updatedAt: business.updatedAt
          }))
        );
      } else {
        // Fallback businesses data
        setBusinesses([
          {
            id: 'biz-1',
            name: 'PersonalOS Ventures',
            industry: 'technology',
            status: 'active',
            teamSize: 1,
            stage: 'startup'
          }
        ]);
      }

      // Generate upcoming calendar events
      const events = generateUpcomingEvents(tasksData, projectsData);
      setUpcomingEvents(events);

      // Show welcome message if coming from login
      if (welcomeMessage) {
        setShowWelcome(true);
        setTimeout(() => setShowWelcome(false), 5000);
      }

      console.log('✅ Dashboard loaded successfully with real data');
      setLoading(false);

    } catch (error) {
      console.error('🚨 Error loading dashboard:', error);
      setLoading(false);
      setAuthError(true);
    }
  };

  const modules = [
    {
      name: 'Tasks',
      icon: ClipboardDocumentListIcon,
      color: 'from-blue-500 to-cyan-500',
      path: '/tasks',
      stats: `${stats.tasks.completed}/${stats.tasks.total} completed`,
      progress: stats.tasks.total > 0 ? (stats.tasks.completed / stats.tasks.total) * 100 : 0
    },
    {
      name: 'Projects',
      icon: FolderIcon,
      color: 'from-purple-500 to-pink-500',
      path: '/projects',
      stats: `${stats.projects.active} active`,
      progress: stats.projects.total > 0 ? (stats.projects.completed / stats.projects.total) * 100 : 0
    },
    {
      name: 'Goals',
      icon: SparklesIcon,
      color: 'from-green-500 to-emerald-500',
      path: '/goals',
      stats: `${stats.goals.achieved}/${stats.goals.total} achieved`,
      progress: stats.goals.total > 0 ? (stats.goals.achieved / stats.goals.total) * 100 : 0
    },
    {
      name: 'Reading',
      icon: BookOpenIcon,
      color: 'from-orange-500 to-red-500',
      path: '/reading',
      stats: `${stats.reading.read}/${stats.reading.total} read`,
      progress: stats.reading.total > 0 ? (stats.reading.read / stats.reading.total) * 100 : 0
    },
    {
      name: 'Skills',
      icon: AcademicCapIcon,
      color: 'from-indigo-500 to-purple-500',
      path: '/skills',
      stats: `${stats.skills.learning} learning`,
      progress: stats.skills.total > 0 ? (stats.skills.mastered / stats.skills.total) * 100 : 0
    },
    {
      name: 'Finances',
      icon: CurrencyDollarIcon,
      color: 'from-emerald-500 to-teal-500',
      path: '/finances',
      stats: `Budget tracking`,
      progress: 0
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Authentication Error</h3>
            <p className="text-gray-600 mb-4">There was an issue with your session. Please log in again.</p>
            <button
              onClick={() => navigate('/auth/login')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Welcome Message */}
      {showWelcome && welcomeMessage && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 border-l-4 border-green-500 max-w-sm">
            <div className="flex items-center">
              <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2" />
              <p className="text-green-700 font-medium">{welcomeMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  PersonalOS Dashboard
                </h1>
                <p className="text-sm text-gray-600">
                  Your personal organization system
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* User Info */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <UserCircleIcon className="w-8 h-8 text-gray-600" />
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {capitalizeFirstLetter(user?.firstName)} {capitalizeFirstLetter(user?.lastName)}
                    </p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigate('/settings')}
                  className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                >
                  <Cog6ToothIcon className="w-5 h-5" />
                  <span className="font-medium">Settings</span>
                </button>
                
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                >
                  <ArrowRightOnRectangleIcon className="w-5 h-5" />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {capitalizeFirstLetter(user?.firstName || 'User')}! 👋
          </h2>
          <p className="text-gray-600">
            Here's what's happening with your personal organization system today.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((module) => (
              <div
                key={module.name}
                onClick={() => navigate(module.path)}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 bg-gradient-to-r ${module.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <module.icon className="w-6 h-6 text-white" />
                  </div>
                  <ChartBarIcon className="w-5 h-5 text-gray-400" />
                </div>
                
                <h4 className="text-lg font-semibold text-gray-900 mb-1">{module.name}</h4>
                <p className="text-sm text-gray-600 mb-3">{module.stats}</p>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`bg-gradient-to-r ${module.color} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(module.progress, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{Math.round(module.progress)}% complete</p>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar & Businesses */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calendar Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <CalendarDaysIcon className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Upcoming Events</h3>
              </div>
              <button 
                onClick={() => navigate('/calendar')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
              >
                <span>View Calendar</span>
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event) => {
                  const IconComponent = event.icon;
                  return (
                    <div 
                      key={event.id} 
                      className={`flex items-center justify-between p-3 rounded-lg border-l-4 ${
                        event.isOverdue ? 'bg-red-50 border-red-400' :
                        event.isToday ? 'bg-blue-50 border-blue-400' :
                        'bg-gray-50 border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-1.5 rounded-full ${
                          event.color === 'blue' ? 'bg-blue-100' :
                          event.color === 'purple' ? 'bg-purple-100' :
                          event.color === 'green' ? 'bg-green-100' :
                          'bg-gray-100'
                        }`}>
                          <IconComponent className={`w-4 h-4 ${
                            event.color === 'blue' ? 'text-blue-600' :
                            event.color === 'purple' ? 'text-purple-600' :
                            event.color === 'green' ? 'text-green-600' :
                            'text-gray-600'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{event.title}</p>
                          <p className={`text-xs ${
                            event.isOverdue ? 'text-red-600' :
                            event.isToday ? 'text-blue-600' :
                            'text-gray-500'
                          }`}>
                            {event.isOverdue ? 'Overdue' : event.isToday ? 'Today' : event.dateString}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        {event.isOverdue && <ClockIcon className="w-4 h-4 text-red-500" />}
                        <button className={`${
                          event.color === 'blue' ? 'text-blue-600 hover:text-blue-700' :
                          event.color === 'purple' ? 'text-purple-600 hover:text-purple-700' :
                          event.color === 'green' ? 'text-green-600 hover:text-green-700' :
                          'text-gray-600 hover:text-gray-700'
                        }`}>
                          <EyeIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <CalendarDaysIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No upcoming events</p>
                  <p className="text-xs text-gray-400 mt-1">Events from tasks and projects will appear here</p>
                </div>
              )}
            </div>
          </div>

          {/* Businesses Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <BuildingOffice2Icon className="w-6 h-6 text-emerald-600" />
                <h3 className="text-lg font-semibold text-gray-900">Your Businesses</h3>
              </div>
              <button 
                onClick={() => navigate('/businesses')}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center space-x-1"
              >
                <span>View All</span>
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              {businesses.length > 0 ? (
                businesses.map((business) => (
                  <div key={business.id} className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                        <BuildingOffice2Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{business.name}</p>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span className="capitalize">{business.industry}</span>
                          <span>•</span>
                          <span className="capitalize">{business.stage}</span>
                          <span>•</span>
                          <span>{business.teamSize} member{business.teamSize !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        business.status === 'active' ? 'bg-green-100 text-green-700' :
                        business.status === 'inactive' ? 'bg-gray-100 text-gray-700' :
                        business.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {business.status}
                      </span>
                      <button className="text-emerald-600 hover:text-emerald-700">
                        <ArrowRightIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <BuildingOffice2Icon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm mb-3">No businesses yet</p>
                  <button 
                    onClick={() => navigate('/businesses/new')}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span>Create Business</span>
                  </button>
                </div>
              )}
            </div>
            
            {businesses.length > 0 && (
              <button 
                onClick={() => navigate('/businesses/new')}
                className="w-full mt-4 py-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors flex items-center justify-center space-x-2"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Add Business</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Card - Replace Bottom CTA */}
        <div className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold mb-2">Your Achievement Summary</h3>
            <p className="text-blue-100">
              Track your progress across all areas of your personal organization system
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Projects Completed */}
            <div className="text-center">
              <div className="bg-white/20 rounded-lg p-6 mb-3">
                <FolderIcon className="w-12 h-12 text-white mx-auto mb-3" />
                <div className="text-3xl font-bold text-white mb-1">
                  {stats.projects.completed}
                </div>
                <div className="text-blue-100 text-sm font-medium">
                  Project{stats.projects.completed !== 1 ? 's' : ''} Completed
                </div>
              </div>
              <div className="text-xs text-blue-200">
                {stats.projects.active} active • {stats.projects.total} total
              </div>
            </div>

            {/* Active Businesses */}
            <div className="text-center">
              <div className="bg-white/20 rounded-lg p-6 mb-3">
                <BuildingOffice2Icon className="w-12 h-12 text-white mx-auto mb-3" />
                <div className="text-3xl font-bold text-white mb-1">
                  {businesses.filter(b => b.status === 'active').length}
                </div>
                <div className="text-blue-100 text-sm font-medium">
                  Active Business{businesses.filter(b => b.status === 'active').length !== 1 ? 'es' : ''}
                </div>
              </div>
              <div className="text-xs text-blue-200">
                {businesses.length} total businesses
              </div>
            </div>

            {/* Goals Achieved */}
            <div className="text-center">
              <div className="bg-white/20 rounded-lg p-6 mb-3">
                <SparklesIcon className="w-12 h-12 text-white mx-auto mb-3" />
                <div className="text-3xl font-bold text-white mb-1">
                  {stats.goals.achieved}
                </div>
                <div className="text-blue-100 text-sm font-medium">
                  Goal{stats.goals.achieved !== 1 ? 's' : ''} Achieved
                </div>
              </div>
              <div className="text-xs text-blue-200">
                {stats.goals.inProgress} in progress • {stats.goals.total} total
              </div>
            </div>
          </div>

          {/* Additional Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/20">
            <div className="text-center">
              <div className="text-xl font-bold text-white mb-1">
                {stats.tasks.completed}
              </div>
              <div className="text-xs text-blue-200">
                Tasks Done
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-xl font-bold text-white mb-1">
                {stats.reading.read}
              </div>
              <div className="text-xs text-blue-200">
                Books Read
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-xl font-bold text-white mb-1">
                {stats.skills.mastered}
              </div>
              <div className="text-xs text-blue-200">
                Skills Mastered
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-xl font-bold text-white mb-1">
                {upcomingEvents.length}
              </div>
              <div className="text-xs text-blue-200">
                Upcoming Events
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <button 
              onClick={() => navigate('/projects/new')}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-white/20 flex items-center space-x-2"
            >
              <PlusIcon className="w-4 h-4" />
              <span>New Project</span>
            </button>
            
            <button 
              onClick={() => navigate('/goals/new')}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-white/20 flex items-center space-x-2"
            >
              <PlusIcon className="w-4 h-4" />
              <span>New Goal</span>
            </button>
            
            <button 
              onClick={() => navigate('/businesses/new')}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-white/20 flex items-center space-x-2"
            >
              <PlusIcon className="w-4 h-4" />
              <span>New Business</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;