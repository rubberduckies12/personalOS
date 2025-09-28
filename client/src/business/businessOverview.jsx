import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, useLocation } from 'react-router-dom';
import {
  BuildingOffice2Icon,
  UsersIcon,
  FolderIcon,
  CubeIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  TrendingDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  StarIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ClockIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  ArrowLeftIcon // Added for back button
} from '@heroicons/react/24/outline';
import {
  BuildingOffice2Icon as BuildingOffice2IconSolid,
  StarIcon as StarIconSolid
} from '@heroicons/react/24/solid';

// Import BusinessDetail component
import BusinessDetail from './businessDetail';

const BusinessOverview = ({ filters: parentFilters }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [filters, setFilters] = useState({
    currency: 'GBP',
    timeframe: '6m',
    ...parentFilters
  });

  // Check if we're on a business detail page
  const isBusinessDetailPage = location.pathname.includes('/business/') && location.pathname !== '/business';

  // Update filters when parent filters change
  useEffect(() => {
    if (parentFilters) {
      setFilters(prev => ({ ...prev, ...parentFilters }));
    }
  }, [parentFilters]);

  // Helper functions
  const getAuthToken = () => {
    return localStorage.getItem('accessToken') || localStorage.getItem('authToken');
  };

  const createFetchOptions = (options = {}) => {
    const token = getAuthToken();
    return {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      },
      ...options
    };
  };

  // Format currency
  const formatCurrency = (amount, currency = 'GBP') => {
    const symbols = { USD: '$', GBP: '£', EUR: '€' };
    return `${symbols[currency] || '£'}${parseFloat(amount || 0).toFixed(2)}`;
  };

  // Navigate to business detail
  const handleBusinessClick = (businessId) => {
    navigate(`/business/${businessId}`);
  };

  // Navigate to create business
  const handleCreateBusiness = () => {
    navigate('/business/create');
  };

  // Calculate comprehensive business totals
  const calculateTotals = () => {
    const totalRevenue = businesses.reduce((sum, business) => 
      sum + (business.products?.reduce((pSum, product) => 
        pSum + (product.metrics?.revenue || 0), 0) || 0), 0);
    
    const totalProducts = businesses.reduce((sum, business) => 
      sum + (business.products?.length || 0), 0);
    
    const activeProducts = businesses.reduce((sum, business) => 
      sum + (business.products?.filter(p => p.status === 'active').length || 0), 0);
    
    const totalTeamMembers = businesses.reduce((sum, business) => 
      sum + (business.activeTeamMembers?.length || business.teamMembers?.filter(m => m.status === 'active').length || 0), 0);
    
    const totalProjects = businesses.reduce((sum, business) => 
      sum + (business.linkedProjects?.length || 0), 0);
    
    const activeBusinesses = businesses.filter(b => b.status === 'active').length;
    const ownedBusinesses = businesses.filter(b => {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      return b.ownerId?._id === currentUser.id || b.ownerId === currentUser.id;
    }).length;

    // Calculate business health metrics
    const businessHealthScores = businesses.map(business => {
      let score = 0;
      
      // Revenue score (0-25)
      const revenue = business.products?.reduce((sum, p) => sum + (p.metrics?.revenue || 0), 0) || 0;
      const targetRevenue = business.metrics?.targetRevenue?.annual || 1;
      const revenueProgress = Math.min(revenue / targetRevenue, 1) * 25;
      score += revenueProgress;
      
      // Team score (0-20)
      const teamSize = business.activeTeamMembers?.length || business.teamMembers?.filter(m => m.status === 'active').length || 0;
      const targetTeam = business.metrics?.employeeCount?.target || 1;
      const teamProgress = Math.min(teamSize / targetTeam, 1) * 20;
      score += teamProgress;
      
      // Product score (0-25)
      const activeProducts = business.products?.filter(p => p.status === 'active').length || 0;
      const totalProducts = business.products?.length || 0;
      const productScore = totalProducts > 0 ? (activeProducts / totalProducts) * 25 : 0;
      score += productScore;
      
      // Project integration score (0-15)
      const projectCount = business.linkedProjects?.length || 0;
      const projectScore = Math.min(projectCount * 3, 15); // 3 points per linked project, max 15
      score += projectScore;
      
      // Activity score (0-15)
      const daysSinceUpdate = (new Date() - new Date(business.updatedAt)) / (1000 * 60 * 60 * 24);
      const activityScore = daysSinceUpdate < 7 ? 15 : daysSinceUpdate < 30 ? 10 : daysSinceUpdate < 90 ? 5 : 0;
      score += activityScore;
      
      return { business, score };
    });

    const avgHealthScore = businessHealthScores.length > 0 
      ? businessHealthScores.reduce((sum, b) => sum + b.score, 0) / businessHealthScores.length 
      : 0;

    return {
      totalRevenue,
      totalProducts,
      activeProducts,
      totalTeamMembers,
      totalProjects,
      activeBusinesses,
      ownedBusinesses,
      avgHealthScore,
      businessHealthScores,
      productionRate: totalProducts > 0 ? (activeProducts / totalProducts) * 100 : 0,
      teamEfficiency: businesses.length > 0 ? totalTeamMembers / businesses.length : 0
    };
  };

  // Business Health Calculator
  const calculateBusinessHealth = () => {
    const totals = calculateTotals();
    
    let healthLevel, color;
    const score = totals.avgHealthScore;
    
    if (score >= 80) {
      healthLevel = "Excellent";
      color = "emerald";
    } else if (score >= 65) {
      healthLevel = "Good";
      color = "green";
    } else if (score >= 50) {
      healthLevel = "Fair";
      color = "yellow";
    } else if (score >= 35) {
      healthLevel = "Poor";
      color = "orange";
    } else {
      healthLevel = "Critical";
      color = "red";
    }
    
    return {
      totalScore: score,
      healthLevel,
      color,
      totals
    };
  };

  // Load business data
  const loadBusinessData = async () => {
    try {
      setLoading(true);
      
      const userData = localStorage.getItem('user');
      const token = getAuthToken();
      
      if (!userData || !token) {
        navigate('/auth/login');
        return;
      }

      const headers = createFetchOptions().headers;

      // Fetch businesses and dashboard stats
      const [businessesRes, statsRes] = await Promise.all([
        fetch(`http://localhost:5001/api/businesses?limit=50&status=all`, { headers }),
        fetch(`http://localhost:5001/api/businesses/dashboard/stats`, { headers }).catch(() => ({ ok: false }))
      ]);

      if (businessesRes.ok) {
        const businessesData = await businessesRes.json();
        setBusinesses(businessesData.businesses || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setAnalytics(statsData);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading business data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only load data if we're on the main business overview page
    if (!isBusinessDetailPage) {
      loadBusinessData();
    }
  }, [filters.currency, isBusinessDetailPage]);

  // If we're on a business detail page, render BusinessDetail component
  if (isBusinessDetailPage) {
    return <BusinessDetail />;
  }

  // Render business grid/cards
  const renderBusinessGrid = () => {
    if (businesses.length === 0) {
      return (
        <div className="text-center py-12">
          <BuildingOffice2Icon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No businesses yet</h3>
          <p className="text-gray-500 mb-6">Start building your business empire by creating your first business.</p>
          <button
            onClick={handleCreateBusiness}
            className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center space-x-2 mx-auto"
          >
            <PlusIcon className="w-5 h-5" />
            <span>Create Your First Business</span>
          </button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {businesses.map((business) => {
          const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
          const isOwner = business.ownerId?._id === currentUser.id || business.ownerId === currentUser.id;
          const revenue = business.products?.reduce((sum, p) => sum + (p.metrics?.revenue || 0), 0) || 0;
          const activeProducts = business.products?.filter(p => p.status === 'active').length || 0;
          const activeTeamMembers = business.teamMembers?.filter(m => m.status === 'active').length || 0;

          return (
            <div 
              key={business._id} 
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:border-emerald-200 transition-all duration-200 cursor-pointer group"
              onClick={() => handleBusinessClick(business._id)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <BuildingOffice2IconSolid className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                        {business.name}
                      </h3>
                      {isOwner && <StarIconSolid className="w-4 h-4 text-yellow-500" />}
                    </div>
                    <p className="text-sm text-gray-500 capitalize">{business.industry?.replace('_', ' ')}</p>
                  </div>
                </div>
                
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  business.status === 'active' ? 'bg-green-100 text-green-800' :
                  business.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {business.status}
                </span>
              </div>

              {/* Description */}
              {business.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{business.description}</p>
              )}

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-lg font-semibold text-green-600">{formatCurrency(revenue, filters.currency)}</p>
                  <p className="text-xs text-gray-500">Revenue</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-emerald-600">{activeProducts}</p>
                  <p className="text-xs text-gray-500">Products</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-blue-600">{activeTeamMembers}</p>
                  <p className="text-xs text-gray-500">Team</p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <CalendarDaysIcon className="w-4 h-4" />
                  <span>Updated {new Date(business.updatedAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center space-x-1 text-emerald-600 group-hover:text-emerald-700">
                  <span className="text-sm font-medium">View Details</span>
                  <ArrowUpIcon className="w-4 h-4 transform rotate-45 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const businessHealth = calculateBusinessHealth();
  const totals = businessHealth.totals;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header - Added to match Finances layout */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all duration-200"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span className="font-medium">Back to Dashboard</span>
              </button>
              
              <div className="border-l border-gray-300 h-6"></div>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Business Overview</h1>
                <p className="text-sm text-gray-600">Manage and monitor all your business ventures</p>
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
              
              <button
                onClick={handleCreateBusiness}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center space-x-2"
              >
                <PlusIcon className="w-5 h-5" />
                <span>New Business</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Business Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Businesses */}
            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-emerald-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                  <BuildingOffice2Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center space-x-1">
                  <ArrowTrendingUpIcon className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs text-emerald-600 font-medium">
                    {totals.activeBusinesses} Active
                  </span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Businesses</h3>
              <p className="text-3xl font-bold text-emerald-600">{businesses.length}</p>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Owned:</span>
                  <span className="font-medium">{totals.ownedBusinesses}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Member of:</span>
                  <span className="font-medium">{businesses.length - totals.ownedBusinesses}</span>
                </div>
              </div>
            </div>

            {/* Total Revenue */}
            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                  <BanknotesIcon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center space-x-1">
                  <ArrowTrendingUpIcon className="w-5 h-5 text-green-600" />
                  <span className="text-xs text-green-600 font-medium">Revenue</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Revenue</h3>
              <p className="text-3xl font-bold text-green-600">{formatCurrency(totals.totalRevenue, filters.currency)}</p>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Products:</span>
                  <span className="font-medium">{totals.activeProducts} active</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Avg per business:</span>
                  <span className="font-medium">{formatCurrency(businesses.length > 0 ? totals.totalRevenue / businesses.length : 0, filters.currency)}</span>
                </div>
              </div>
            </div>

            {/* Team Members */}
            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                  <UsersIcon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center space-x-1">
                  <UsersIcon className="w-5 h-5 text-blue-600" />
                  <span className="text-xs text-blue-600 font-medium">
                    {totals.teamEfficiency.toFixed(1)} avg
                  </span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Team Members</h3>
              <p className="text-3xl font-bold text-blue-600">{totals.totalTeamMembers}</p>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Businesses:</span>
                  <span className="font-medium">{businesses.length} total</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Team efficiency:</span>
                  <span className="font-medium">{totals.teamEfficiency.toFixed(1)} per business</span>
                </div>
              </div>
            </div>

            {/* Projects Integration */}
            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center">
                  <FolderIcon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center space-x-1">
                  <FolderIcon className="w-5 h-5 text-purple-600" />
                  <span className="text-xs text-purple-600 font-medium">Linked</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Linked Projects</h3>
              <p className="text-3xl font-bold text-purple-600">{totals.totalProjects}</p>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Products:</span>
                  <span className="font-medium">{totals.totalProducts} total</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Production rate:</span>
                  <span className="font-medium">{totals.productionRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Business Health Dashboard - Only show if there are businesses */}
          {businesses.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Health Score Card */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                  <CheckCircleIcon className="w-5 h-5 mr-2 text-emerald-600" />
                  Business Health Score
                </h3>
                
                <div className="text-center mb-6">
                  <div className={`text-6xl font-bold mb-2 text-${businessHealth.color}-600`}>
                    {businessHealth.totalScore.toFixed(0)}
                  </div>
                  <div className={`text-lg font-medium text-${businessHealth.color}-600`}>
                    {businessHealth.healthLevel}
                  </div>
                </div>

                {/* Health Score Breakdown */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Revenue Progress</span>
                      <span>{((totals.totalRevenue / businesses.reduce((sum, b) => sum + (b.metrics?.targetRevenue?.annual || 1), 0)) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                        style={{ width: `${Math.min((totals.totalRevenue / businesses.reduce((sum, b) => sum + (b.metrics?.targetRevenue?.annual || 1), 0)) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Active Products</span>
                      <span>{totals.productionRate.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-600"
                        style={{ width: `${totals.productionRate}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Team Integration</span>
                      <span>{Math.min(totals.teamEfficiency * 20, 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-purple-400 to-purple-600"
                        style={{ width: `${Math.min(totals.teamEfficiency * 20, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Project Links</span>
                      <span>{Math.min(totals.totalProjects * 10, 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600"
                        style={{ width: `${Math.min(totals.totalProjects * 10, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Business Activity</span>
                      <span>{((totals.activeBusinesses / businesses.length) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-green-400 to-green-600"
                        style={{ width: `${(totals.activeBusinesses / Math.max(businesses.length, 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Business Metrics */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <ChartBarIcon className="w-5 h-5 mr-2 text-emerald-600" />
                  Key Business Metrics
                </h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Revenue per Business</span>
                    <span className="font-medium">
                      {formatCurrency(businesses.length > 0 ? totals.totalRevenue / businesses.length : 0, filters.currency)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Product Success Rate</span>
                    <span className={`font-medium ${totals.productionRate >= 75 ? 'text-green-600' : totals.productionRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {totals.productionRate.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Team Efficiency</span>
                    <span className={`font-medium ${totals.teamEfficiency >= 5 ? 'text-green-600' : totals.teamEfficiency >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {totals.teamEfficiency.toFixed(1)} members/business
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Project Integration</span>
                    <span className={`font-medium ${totals.totalProjects >= businesses.length ? 'text-green-600' : totals.totalProjects > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {businesses.length > 0 ? (totals.totalProjects / businesses.length).toFixed(1) : 0} projects/business
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Business Activity Rate</span>
                    <span className={`font-medium ${(totals.activeBusinesses / Math.max(businesses.length, 1)) >= 0.8 ? 'text-green-600' : (totals.activeBusinesses / Math.max(businesses.length, 1)) >= 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {((totals.activeBusinesses / Math.max(businesses.length, 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Portfolio Health</h4>
                  <div className="flex justify-between text-sm">
                    <span>Overall Score:</span>
                    <span className={`font-medium text-${businessHealth.color}-600`}>
                      {businessHealth.totalScore.toFixed(0)}/100
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Business Grid */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Your Businesses</h2>
              {businesses.length > 0 && (
                <span className="text-sm text-gray-500">{businesses.length} businesses</span>
              )}
            </div>
            
            {renderBusinessGrid()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default BusinessOverview;