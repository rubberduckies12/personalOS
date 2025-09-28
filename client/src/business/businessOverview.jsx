import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BuildingOffice2Icon,
  UsersIcon,
  FolderIcon,
  CubeIcon,
  ChartBarIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  StarIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ClockIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';
import {
  BuildingOffice2Icon as BuildingOffice2IconSolid,
  StarIcon as StarIconSolid
} from '@heroicons/react/24/solid';

const BusinessOverview = ({ filters: parentFilters }) => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [filters, setFilters] = useState({
    currency: 'GBP',
    timeframe: '6m',
    ...parentFilters
  });

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
    
    let healthLevel, recommendations, color;
    const score = totals.avgHealthScore;
    
    if (score >= 80) {
      healthLevel = "Excellent";
      color = "emerald";
      recommendations = [
        "Consider expanding to new markets",
        "Explore strategic partnerships",
        "Document successful processes for scaling"
      ];
    } else if (score >= 65) {
      healthLevel = "Good";
      color = "green";
      recommendations = [
        "Focus on product development",
        "Strengthen team collaboration",
        "Improve project integration"
      ];
    } else if (score >= 50) {
      healthLevel = "Fair";
      color = "yellow";
      recommendations = [
        "Review business strategy",
        "Increase product launch frequency",
        "Enhance team productivity"
      ];
    } else if (score >= 35) {
      healthLevel = "Poor";
      color = "orange";
      recommendations = [
        "Reassess business model",
        "Focus on core products",
        "Improve operational efficiency"
      ];
    } else {
      healthLevel = "Critical";
      color = "red";
      recommendations = [
        "Immediate strategic review needed",
        "Consider business pivot",
        "Seek mentorship or consulting"
      ];
    }
    
    return {
      totalScore: score,
      healthLevel,
      recommendations,
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
        fetch(`http://localhost:5001/api/businesses/dashboard/stats`, { headers })
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
    loadBusinessData();
  }, [filters.currency]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const businessHealth = calculateBusinessHealth();
  const totals = businessHealth.totals;

  return (
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
                <TrendingUpIcon className="w-5 h-5 text-emerald-600" />
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
                <TrendingUpIcon className="w-5 h-5 text-green-600" />
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

        {/* Business Health Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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

          {/* Recommendations */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <InformationCircleIcon className="w-5 h-5 mr-2 text-emerald-600" />
              Recommendations
            </h3>
            
            <div className="space-y-3">
              {businessHealth.recommendations.map((recommendation, index) => (
                <div key={index} className={`p-3 rounded-lg border-l-4 border-${businessHealth.color}-500 bg-${businessHealth.color}-50`}>
                  <p className="text-sm text-gray-700">{recommendation}</p>
                </div>
              ))}
            </div>

            {/* Business Growth Status */}
            <div className="mt-6 p-4 bg-emerald-50 rounded-lg">
              <h4 className="font-medium text-emerald-900 mb-2">Growth Opportunities</h4>
              <p className="text-sm text-emerald-700">
                You have {businesses.length} businesses with {totals.activeBusinesses} actively managed.
                {businesses.length < 3 && " Consider starting new ventures."}
                {totals.productionRate < 50 && " Focus on activating more products."}
                {totals.totalProjects === 0 && " Link projects to track progress."}
              </p>
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

        {/* Visual Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Business Performance Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <ChartBarIcon className="w-5 h-5 mr-2 text-emerald-600" />
              Business Performance
            </h3>
            <div className="space-y-4">
              {businessHealth.totals.businessHealthScores.slice(0, 5).map(({ business, score }) => (
                <div key={business._id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-900 truncate">{business.name}</span>
                    <span className="text-gray-600">{score.toFixed(0)}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        score >= 80 ? 'bg-emerald-500' :
                        score >= 65 ? 'bg-green-500' :
                        score >= 50 ? 'bg-yellow-500' :
                        score >= 35 ? 'bg-orange-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${score}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{business.products?.length || 0} products</span>
                    <span>{business.teamMembers?.filter(m => m.status === 'active').length || 0} team</span>
                  </div>
                </div>
              ))}
              {businesses.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <BuildingOffice2Icon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>No businesses created yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Industry Distribution */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CubeIcon className="w-5 h-5 mr-2 text-emerald-600" />
              Industry Distribution
            </h3>
            <div className="space-y-4">
              {(() => {
                const industryTotals = businesses.reduce((acc, business) => {
                  acc[business.industry] = (acc[business.industry] || 0) + 1;
                  return acc;
                }, {});
                
                const totalBusinesses = businesses.length;
                
                return Object.entries(industryTotals)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 6)
                  .map(([industry, count]) => {
                    const percentage = totalBusinesses > 0 ? (count / totalBusinesses) * 100 : 0;
                    return (
                      <div key={industry} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-900 capitalize">{industry.replace('_', ' ')}</span>
                          <span className="text-gray-600">{count} businesses</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 text-right">
                          {percentage.toFixed(1)}% of portfolio
                        </div>
                      </div>
                    );
                  });
              })()}
              {businesses.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CubeIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>No industry data available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Business Activity */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Business Activity</h3>
          <div className="space-y-3">
            {businesses
              .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
              .slice(0, 5)
              .map((business, index) => {
                const isOwner = (() => {
                  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                  return business.ownerId?._id === currentUser.id || business.ownerId === currentUser.id;
                })();
                
                return (
                  <div key={business._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => navigate(`/business/${business._id}`)}>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                        <BuildingOffice2IconSolid className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 flex items-center space-x-2">
                          <span>{business.name}</span>
                          {isOwner && <StarIconSolid className="w-3 h-3 text-yellow-500" />}
                        </p>
                        <p className="text-xs text-gray-500">
                          {business.industry?.replace('_', ' ')} • Updated {new Date(business.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {business.products?.filter(p => p.status === 'active').length || 0} products
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        business.status === 'active' ? 'text-green-600 bg-green-100' :
                        business.status === 'paused' ? 'text-yellow-600 bg-yellow-100' :
                        'text-gray-600 bg-gray-100'
                      }`}>
                        {business.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            {businesses.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <BuildingOffice2Icon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default BusinessOverview;