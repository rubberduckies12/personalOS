import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrophyIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  FlagIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

// Import components
import SetGoals from './setGoals';
import Progress from './progress';
import Overview from './overveiw';

const Goals = () => {
  const navigate = useNavigate();
  
  // State
  const [activeTab, setActiveTab] = useState('overview');

  // Navigation tabs
  const tabs = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'setGoals', name: 'Set Goals', icon: FlagIcon },
    { id: 'progress', name: 'Progress', icon: ArrowTrendingUpIcon }
  ];

  // Get tab-specific header content
  const getHeaderContent = () => {
    switch (activeTab) {
      case 'overview':
        return {
          title: 'Goals Overview',
          subtitle: 'Track your progress and achievements across all goals'
        };
      case 'setGoals':
        return {
          title: 'Goal Management',
          subtitle: 'Create, edit, and manage your personal and professional goals'
        };
      case 'progress':
        return {
          title: 'Progress Tracking',
          subtitle: 'Log progress updates and monitor your goal achievements'
        };
      default:
        return {
          title: 'Goals Center',
          subtitle: 'Track, manage, and achieve your personal and professional goals'
        };
    }
  };

  // Render active component content only (without their headers)
  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview />;
      case 'setGoals':
        return <SetGoals />;
      case 'progress':
        return <Progress />;
      default:
        return <Overview />;
    }
  };

  const headerContent = getHeaderContent();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header - Always Visible */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span className="font-medium">Back to Dashboard</span>
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
              <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50 rounded-lg">
                <TrophyIcon className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Goals Dashboard</span>
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
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
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

export default Goals;