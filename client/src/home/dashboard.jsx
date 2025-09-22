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
  Cog6ToothIcon
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
  const [recentActivity, setRecentActivity] = useState([]);
  const [todaysFocus, setTodaysFocus] = useState([]);
  const [showWelcome, setShowWelcome] = useState(false);

  // Get welcome message from login redirect
  const welcomeMessage = location.state?.message;

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (string) => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  };

  // Logout function
  const handleLogout = async () => {
    try {
      // Clear local storage
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      
      // Make logout request to clear HTTP cookies
      await fetch('http://localhost:5000/api/auth/logout', {
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

  useEffect(() => {
    loadDashboardData();
  }, [navigate, welcomeMessage]);

  const loadDashboardData = async () => {
    try {
      // Get user data from localStorage
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      } else {
        navigate('/auth/login');
        return;
      }

      // Get JWT token
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const userId = JSON.parse(userData).id;

      // Fetch dashboard data from all endpoints
      const [
        tasksResponse,
        projectsResponse,
        goalsResponse,
        readingResponse,
        skillsResponse,
        financesResponse
      ] = await Promise.all([
        fetch('http://localhost:5000/api/tasks/analytics/overview', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'user-id': userId,
            'Content-Type': 'application/json'
          }
        }),
        fetch('http://localhost:5000/api/projects/stats/dashboard', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'user-id': userId,
            'Content-Type': 'application/json'
          }
        }),
        fetch('http://localhost:5000/api/goals/stats/dashboard', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'user-id': userId,
            'Content-Type': 'application/json'
          }
        }),
        fetch('http://localhost:5000/api/reading/stats/dashboard', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'user-id': userId,
            'Content-Type': 'application/json'
          }
        }),
        fetch('http://localhost:5000/api/skills/analytics/overview', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'user-id': userId,
            'Content-Type': 'application/json'
          }
        }),
        fetch('http://localhost:5000/api/finances/budgets?limit=1', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'user-id': userId,
            'Content-Type': 'application/json'
          }
        })
      ]);

      // Process responses
      const [
        tasksData,
        projectsData,
        goalsData,
        readingData,
        skillsData,
        financesData
      ] = await Promise.all([
        tasksResponse.ok ? tasksResponse.json() : { summary: { total: 0, completed: 0, active: 0 } },
        projectsResponse.ok ? projectsResponse.json() : { overview: { totalProjects: 0, activeProjects: 0, completedProjects: 0 } },
        goalsResponse.ok ? goalsResponse.json() : { overview: { total: 0, achieved: 0, inProgress: 0 } },
        readingResponse.ok ? readingResponse.json() : { overview: { total: 0, completed: 0, currentlyReading: 0 } },
        skillsResponse.ok ? skillsResponse.json() : { overview: { total: 0, mastered: 0, learning: 0 } },
        financesResponse.ok ? financesResponse.json() : { summary: { total: 0 } }
      ]);

      // Update stats with real data
      setStats({
        tasks: {
          total: tasksData.summary?.total || 0,
          completed: tasksData.summary?.completed || 0,
          pending: tasksData.summary?.active || 0
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
          read: readingData.overview?.completed || 0,
          currentlyReading: readingData.overview?.currentlyReading || 0
        },
        skills: {
          total: skillsData.overview?.total || 0,
          mastered: skillsData.overview?.mastered || 0,
          learning: skillsData.overview?.learning || 0
        },
        finances: {
          income: 0, // Will be calculated from finances data
          expenses: 0,
          savings: 0
        }
      });

      // Set recent activity from various sources
      const activity = [];
      
      // Add recent tasks
      if (tasksData.completionTrend) {
        tasksData.completionTrend.slice(-3).forEach((trend, index) => {
          if (trend.completed > 0) {
            activity.push({
              id: `task-${index}`,
              type: 'task',
              action: 'completed',
              item: `${trend.completed} task${trend.completed > 1 ? 's' : ''}`,
              time: trend.date
            });
          }
        });
      }

      // Add recent projects
      if (projectsData.recentProjects) {
        projectsData.recentProjects.slice(0, 2).forEach((project, index) => {
          activity.push({
            id: `project-${index}`,
            type: 'project',
            action: 'updated',
            item: project.title,
            time: new Date(project.updatedAt).toLocaleDateString()
          });
        });
      }

      // Add recent reading
      if (readingData.recentlyCompleted) {
        readingData.recentlyCompleted.slice(0, 2).forEach((book, index) => {
          activity.push({
            id: `reading-${index}`,
            type: 'reading',
            action: 'completed',
            item: book.title,
            time: new Date(book.completedAt).toLocaleDateString()
          });
        });
      }

      setRecentActivity(activity.slice(0, 4));

      // Set today's focus from current tasks and projects
      const focus = [];
      
      if (projectsData.recentProjects) {
        projectsData.recentProjects.slice(0, 2).forEach((project, index) => {
          focus.push({
            id: `focus-project-${index}`,
            type: 'project',
            title: `Work on ${project.title}`,
            status: project.status,
            color: 'blue'
          });
        });
      }

      if (readingData.currentlyReading) {
        readingData.currentlyReading.slice(0, 1).forEach((book, index) => {
          focus.push({
            id: `focus-reading-${index}`,
            type: 'reading',
            title: `Continue reading ${book.title}`,
            status: 'in_progress',
            color: 'green'
          });
        });
      }

      setTodaysFocus(focus.slice(0, 3));

      // Show welcome message if coming from login
      if (welcomeMessage) {
        setShowWelcome(true);
        setTimeout(() => setShowWelcome(false), 5000);
      }

      setLoading(false);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setLoading(false);
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
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
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
            Welcome back, {capitalizeFirstLetter(user?.firstName)}! 👋
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

        {/* Recent Activity & Today's Focus */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                View All
              </button>
            </div>
            
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      activity.type === 'task' ? 'bg-blue-100' :
                      activity.type === 'goal' ? 'bg-green-100' :
                      activity.type === 'reading' ? 'bg-orange-100' :
                      activity.type === 'project' ? 'bg-purple-100' :
                      'bg-gray-100'
                    }`}>
                      {activity.type === 'task' && <ClipboardDocumentListIcon className="w-4 h-4 text-blue-600" />}
                      {activity.type === 'goal' && <SparklesIcon className="w-4 h-4 text-green-600" />}
                      {activity.type === 'reading' && <BookOpenIcon className="w-4 h-4 text-orange-600" />}
                      {activity.type === 'project' && <FolderIcon className="w-4 h-4 text-purple-600" />}
                      {activity.type === 'skill' && <AcademicCapIcon className="w-4 h-4 text-purple-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.action.charAt(0).toUpperCase() + activity.action.slice(1)} {activity.item}
                      </p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No recent activity</p>
              )}
            </div>
          </div>

          {/* Today's Focus */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Today's Focus</h3>
              <CalendarDaysIcon className="w-5 h-5 text-gray-400" />
            </div>
            
            <div className="space-y-3">
              {todaysFocus.length > 0 ? (
                todaysFocus.map((item) => (
                  <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg ${
                    item.color === 'blue' ? 'bg-blue-50' :
                    item.color === 'green' ? 'bg-green-50' :
                    item.color === 'purple' ? 'bg-purple-50' :
                    'bg-gray-50'
                  }`}>
                    <div className="flex items-center space-x-3">
                      {item.type === 'project' && <FolderIcon className="w-5 h-5 text-blue-600" />}
                      {item.type === 'reading' && <BookOpenIcon className="w-5 h-5 text-green-600" />}
                      {item.type === 'skill' && <AcademicCapIcon className="w-5 h-5 text-purple-600" />}
                      <span className="text-sm font-medium text-gray-900">{item.title}</span>
                    </div>
                    <button className={`${
                      item.color === 'blue' ? 'text-blue-600 hover:text-blue-700' :
                      item.color === 'green' ? 'text-green-600 hover:text-green-700' :
                      item.color === 'purple' ? 'text-purple-600 hover:text-purple-700' :
                      'text-gray-600 hover:text-gray-700'
                    }`}>
                      <EyeIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No focus items for today</p>
              )}
            </div>
            
            <button className="w-full mt-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
              Add Focus Item
            </button>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white text-center">
          <h3 className="text-xl font-semibold mb-2">Ready to be more productive?</h3>
          <p className="text-blue-100 mb-4">
            Start organizing your digital life with PersonalOS's powerful tools.
          </p>
          <button 
            onClick={() => navigate('/tasks')}
            className="bg-white text-blue-600 px-6 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors"
          >
            Get Started
          </button>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;