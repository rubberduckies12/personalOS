import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BuildingOffice2Icon,
  ChartBarIcon,
  FolderIcon,
  UsersIcon,
  CogIcon,
  ArrowLeftIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  CubeIcon,
  StarIcon as StarIconOutline
} from '@heroicons/react/24/outline';
import {
  BuildingOffice2Icon as BuildingOffice2IconSolid,
  StarIcon as StarIconSolid
} from '@heroicons/react/24/solid';

// Import tab components
import BusinessProjects from './businessProjects';
import BusinessTeam from './businessTeam';

const BusinessDetail = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();
  
  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [filters, setFilters] = useState({
    currency: 'GBP'
  });

  // Helper functions
  const getAuthToken = () => localStorage.getItem('accessToken') || localStorage.getItem('authToken');

  const createFetchOptions = (options = {}) => ({
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
      ...options.headers
    },
    ...options
  });

  // Format currency
  const formatCurrency = (amount, currency = 'GBP') => {
    const symbols = { USD: '$', GBP: '£', EUR: '€' };
    return `${parseFloat(amount || 0).toFixed(2)}`;
  };

  // Load business data
  const loadBusinessData = async () => {
    try {
      setLoading(true);
      
      // Validate business ID format
      if (!businessId || businessId.length !== 24) {
        console.error('Invalid business ID:', businessId);
        navigate('/business');
        return;
      }
      
      console.log('🔍 Loading business data for ID:', businessId);
      
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );

      const fetchPromise = Promise.all([
        fetch(`http://localhost:5001/api/businesses/${businessId}`, createFetchOptions()),
        fetch(`http://localhost:5001/api/businesses/${businessId}/analytics`, createFetchOptions()).catch(() => ({ ok: false }))
      ]);

      const [businessRes, analyticsRes] = await Promise.race([fetchPromise, timeoutPromise]);

      console.log('📊 Business response status:', businessRes.status);

      if (businessRes.ok) {
        const businessData = await businessRes.json();
        setBusiness(businessData);
        console.log('✅ Loaded business data:', businessData.name);
      } else {
        // Handle specific error cases
        const errorData = await businessRes.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Business API error:', businessRes.status, errorData);
        
        if (businessRes.status === 404) {
          console.error('Business not found');
          navigate('/business');
          return;
        } else if (businessRes.status === 403) {
          console.error('Access denied to business');
          navigate('/business');
          return;
        } else if (businessRes.status === 500) {
          console.error('Server error loading business:', errorData);
          // Show error message but don't redirect
          setBusiness({
            _id: businessId,
            name: 'Error Loading Business',
            description: 'There was an error loading this business. Please check the console for details.',
            status: 'unknown',
            industry: 'unknown',
            stage: 'unknown',
            createdAt: new Date(),
            products: [],
            teamMembers: [],
            linkedProjects: [],
            metrics: {},
            error: errorData.details || errorData.error || 'Server error'
          });
        } else {
          throw new Error(`HTTP ${businessRes.status}: ${businessRes.statusText}`);
        }
      }

      if (analyticsRes && analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData);
      } else {
        // Set default analytics if endpoint doesn't exist
        setAnalytics({
          projects: { active: 0, completed: 0 },
          tasks: { total: 0 },
          timeline: { recentActivity: [] }
        });
      }

    } catch (error) {
      console.error('💥 Error loading business data:', error);
      console.error('Error stack:', error.stack);
      
      // Set fallback data instead of navigating away
      setBusiness({
        _id: businessId,
        name: 'Error Loading Business',
        description: `Failed to load business data: ${error.message}`,
        status: 'unknown',
        industry: 'unknown',
        stage: 'unknown',
        createdAt: new Date(),
        products: [],
        teamMembers: [],
        linkedProjects: [],
        metrics: {},
        error: error.message
      });
      
      setAnalytics({
        projects: { active: 0, completed: 0 },
        tasks: { total: 0 },
        timeline: { recentActivity: [] }
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessId) {
      console.log('Loading business data for ID:', businessId); // Debug log
      loadBusinessData();
    } else {
      console.error('No businessId provided');
      navigate('/business');
    }
  }, [businessId]); // Remove navigate from dependencies to prevent loops

  // Navigation tabs
  const tabs = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'projects', name: 'Projects', icon: FolderIcon },
    { id: 'team', name: 'Team', icon: UsersIcon },
    { id: 'settings', name: 'Settings', icon: CogIcon }
  ];

  // Get tab-specific header content
  const getHeaderContent = () => {
    if (!business || business.name === 'Loading...') {
      return {
        title: 'Business Dashboard',
        subtitle: 'Loading business information...'
      };
    }

    switch (activeTab) {
      case 'overview':
        return {
          title: `${business.name} - Overview`,
          subtitle: 'Complete analysis of your business performance'
        };
      case 'projects':
        return {
          title: `${business.name} - Projects`,
          subtitle: 'Manage and track projects linked to this business'
        };
      case 'team':
        return {
          title: `${business.name} - Team`,
          subtitle: 'Manage team members and permissions'
        };
      case 'settings':
        return {
          title: `${business.name} - Settings`,
          subtitle: 'Configure business settings and preferences'
        };
      default:
        return {
          title: business.name,
          subtitle: 'Business dashboard and management'
        };
    }
  };

  // Individual Business Overview Component
  const renderIndividualBusinessOverview = () => {
    if (!business || business.name === 'Loading...') {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading business overview...</p>
          </div>
        </div>
      );
    }

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const isOwner = business.ownerId?._id === currentUser.id || business.ownerId === currentUser.id;

    // Calculate business metrics
    const totalRevenue = business.products?.reduce((sum, product) => 
      sum + (product.metrics?.revenue || 0), 0) || 0;
    const activeProducts = business.products?.filter(p => p.status === 'active').length || 0;
    const totalProducts = business.products?.length || 0;
    const activeTeamMembers = business.teamMembers?.filter(m => m.status === 'active').length || 0;
    const linkedProjects = business.linkedProjects?.length || 0;

    // Calculate health score
    let healthScore = 0;
    const targetRevenue = business.metrics?.targetRevenue?.annual || 1;
    const revenueProgress = Math.min(totalRevenue / targetRevenue, 1) * 30;
    const productScore = totalProducts > 0 ? (activeProducts / totalProducts) * 25 : 0;
    const teamScore = Math.min(activeTeamMembers * 5, 20);
    const projectScore = Math.min(linkedProjects * 3, 15);
    const activityScore = business.status === 'active' ? 10 : 0;
    
    healthScore = revenueProgress + productScore + teamScore + projectScore + activityScore;

    const getHealthLevel = (score) => {
      if (score >= 80) return { level: "Excellent", color: "emerald" };
      if (score >= 65) return { level: "Good", color: "green" };
      if (score >= 50) return { level: "Fair", color: "yellow" };
      if (score >= 35) return { level: "Poor", color: "orange" };
      return { level: "Critical", color: "red" };
    };

    const healthInfo = getHealthLevel(healthScore);

    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Business Info Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                  <BuildingOffice2IconSolid className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <h2 className="text-2xl font-bold text-gray-900">{business.name}</h2>
                    {isOwner && <StarIconSolid className="w-5 h-5 text-yellow-500" />}
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                      business.status === 'active' ? 'bg-green-100 text-green-800' :
                      business.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {business.status}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-3 max-w-2xl">{business.description}</p>
                  <div className="flex items-center space-x-6 text-sm text-gray-500">
                    <span className="flex items-center space-x-1">
                      <CubeIcon className="w-4 h-4" />
                      <span className="capitalize">{business.industry?.replace('_', ' ')}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <StarIconOutline className="w-4 h-4" />
                      <span className="capitalize">{business.stage}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <CalendarDaysIcon className="w-4 h-4" />
                      <span>Created {new Date(business.createdAt).toLocaleDateString()}</span>
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className={`text-3xl font-bold text-${healthInfo.color}-600 mb-1`}>
                  {healthScore.toFixed(0)}
                </div>
                <div className={`text-sm font-medium text-${healthInfo.color}-600`}>
                  {healthInfo.level}
                </div>
                <div className="text-xs text-gray-500 mt-1">Health Score</div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Revenue */}
            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                  <BanknotesIcon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center space-x-1">
                  <ArrowTrendingUpIcon className="w-5 h-5 text-green-600" />
                  <span className="text-xs text-green-600 font-medium">
                    {((totalRevenue / (business.metrics?.targetRevenue?.annual || 1)) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Revenue</h3>
              <p className="text-3xl font-bold text-green-600">£{formatCurrency(totalRevenue, filters.currency)}</p>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Target:</span>
                  <span className="font-medium">£{formatCurrency(business.metrics?.targetRevenue?.annual || 0, filters.currency)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Products:</span>
                  <span className="font-medium">{activeProducts} active</span>
                </div>
              </div>
            </div>

            {/* Team */}
            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                  <UsersIcon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center space-x-1">
                  <UserGroupIcon className="w-5 h-5 text-blue-600" />
                  <span className="text-xs text-blue-600 font-medium">
                    {business.teamMembers?.filter(m => m.status === 'pending').length || 0} pending
                  </span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Team Members</h3>
              <p className="text-3xl font-bold text-blue-600">{activeTeamMembers}</p>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Target:</span>
                  <span className="font-medium">{business.metrics?.employeeCount?.target || 1}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Your role:</span>
                  <span className="font-medium capitalize">{isOwner ? 'owner' : 'member'}</span>
                </div>
              </div>
            </div>

            {/* Projects */}
            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center">
                  <FolderIcon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center space-x-1">
                  <CheckCircleIcon className="w-5 h-5 text-purple-600" />
                  <span className="text-xs text-purple-600 font-medium">
                    {analytics?.projects?.completed || 0} completed
                  </span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Linked Projects</h3>
              <p className="text-3xl font-bold text-purple-600">{linkedProjects}</p>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Active:</span>
                  <span className="font-medium">{analytics?.projects?.active || 0}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Tasks:</span>
                  <span className="font-medium">{analytics?.tasks?.total || 0}</span>
                </div>
              </div>
            </div>

            {/* Products */}
            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-emerald-500">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                  <CubeIcon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center space-x-1">
                  <ArrowTrendingUpIcon className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs text-emerald-600 font-medium">
                    {totalProducts > 0 ? ((activeProducts / totalProducts) * 100).toFixed(0) : 0}% active
                  </span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Products</h3>
              <p className="text-3xl font-bold text-emerald-600">{totalProducts}</p>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Active:</span>
                  <span className="font-medium">{activeProducts}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Development:</span>
                  <span className="font-medium">{business.products?.filter(p => p.status === 'development').length || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button
              onClick={() => setActiveTab('projects')}
              className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 text-left"
            >
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FolderIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">View Projects</h3>
                  <p className="text-sm text-gray-500">{linkedProjects} linked projects</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Manage project roadmap and track progress across all linked projects.
              </p>
            </button>

            <button
              onClick={() => setActiveTab('team')}
              className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 text-left"
            >
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <UsersIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Manage Team</h3>
                  <p className="text-sm text-gray-500">{activeTeamMembers} active members</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Invite team members, manage roles and permissions for this business.
              </p>
            </button>

            {isOwner && (
              <button
                onClick={() => setActiveTab('settings')}
                className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 text-left"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <CogIcon className="w-6 h-6 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
                    <p className="text-sm text-gray-500">Configure business</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  Edit business information, manage settings and danger zone actions.
                </p>
              </button>
            )}
          </div>
        </div>
      </main>
    );
  };

  // Settings Component
  const renderSettings = () => (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Settings</h3>
        <p className="text-gray-600">Settings functionality will be implemented here.</p>
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            Business settings including editing business information, managing permissions, and danger zone actions.
          </p>
        </div>
      </div>
    </main>
  );

  // FIXED: Render active component content with proper props
  const renderActiveComponent = () => {
    console.log('Rendering active component:', activeTab); // Debug log
    
    switch (activeTab) {
      case 'overview':
        return renderIndividualBusinessOverview();
      case 'projects':
        // FIXED: Pass business data to prevent separate loading
        return <BusinessProjects businessData={business} />;
      case 'team':
        // FIXED: Pass business data to prevent separate loading
        return <BusinessTeam businessData={business} />;
      case 'settings':
        return renderSettings();
      default:
        return renderIndividualBusinessOverview();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading business details...</p>
          <p className="text-xs text-gray-500 mt-2">Business ID: {businessId}</p>
        </div>
      </div>
    );
  }

  const headerContent = getHeaderContent();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header - Always Visible */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/business')}
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all duration-200"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span className="font-medium">Back to Businesses</span>
              </button>
              
              <div className="border-l border-gray-300 h-6"></div>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {headerContent.title}
                </h1>
                <p className="text-sm text-gray-600">
                  {headerContent.subtitle}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <select
                value={filters.currency}
                onChange={(e) => setFilters(prev => ({ ...prev, currency: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="GBP">GBP (£)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
              
              <div className="flex items-center space-x-2 px-3 py-2 bg-emerald-50 rounded-lg">
                <BuildingOffice2Icon className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-900">Business Dashboard</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs - Always Visible */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    console.log('Switching to tab:', tab.id); // Debug log
                    setActiveTab(tab.id);
                  }}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Render Active Component Content */}
      <div className="flex-1">
        {renderActiveComponent()}
      </div>
    </div>
  );
};

export default BusinessDetail;
