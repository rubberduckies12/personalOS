import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CubeIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  PlusIcon,
  FlagIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

// Import components
import SetProject from './setProject';
import SetProgress from './setProgress';
import Overview from './overview';

const Projects = () => {
  const navigate = useNavigate();
  
  // State
  const [activeTab, setActiveTab] = useState('overview');

  // Navigation tabs
  const tabs = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'setProject', name: 'Set Projects', icon: PlusIcon },
    { id: 'progress', name: 'Progress', icon: ArrowTrendingUpIcon }
  ];

  // Get tab-specific header content
  const getHeaderContent = () => {
    switch (activeTab) {
      case 'overview':
        return {
          title: 'Projects Overview',
          subtitle: 'Track your progress and achievements across all projects'
        };
      case 'setProject':
        return {
          title: 'Project Management',
          subtitle: 'Create, edit, and manage your projects with milestones'
        };
      case 'progress':
        return {
          title: 'Progress Tracking',
          subtitle: 'Complete milestones and monitor your project achievements'
        };
      default:
        return {
          title: 'Project Center',
          subtitle: 'Plan, manage, and track your projects from start to finish'
        };
    }
  };

  // Render active component content only (without their headers)
  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview />;
      case 'setProject':
        return <SetProject />;
      case 'progress':
        return <SetProgress />;
      default:
        return <Overview />;
    }
  };

  const headerContent = getHeaderContent();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
      {/* Header - Always Visible */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all duration-200"
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
              <div className="flex items-center space-x-2 px-3 py-2 bg-purple-50 rounded-lg">
                <CubeIcon className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Projects Dashboard</span>
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
                      ? 'border-purple-500 text-purple-600'
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

export default Projects;