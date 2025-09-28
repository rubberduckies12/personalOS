import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpenIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  PlusIcon,
  CogIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

// Import components
import Overview from './overveiw';
import SetBook from './setBook';
import SetProgress from './setProgress';

const Reading = () => {
  const navigate = useNavigate();
  
  // State
  const [activeTab, setActiveTab] = useState('overview');

  // Navigation tabs
  const tabs = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'setBook', name: 'Manage Books', icon: PlusIcon },
    { id: 'progress', name: 'Track Progress', icon: ArrowTrendingUpIcon }
  ];

  // Get tab-specific header content
  const getHeaderContent = () => {
    switch (activeTab) {
      case 'overview':
        return {
          title: 'Reading Overview',
          subtitle: 'Track your reading progress and discover your reading patterns'
        };
      case 'setBook':
        return {
          title: 'Book Management',
          subtitle: 'Add, organize, and manage your personal reading library'
        };
      case 'progress':
        return {
          title: 'Progress Tracking',
          subtitle: 'Log reading sessions and complete chapters with detailed summaries'
        };
      default:
        return {
          title: 'Reading Center',
          subtitle: 'Track, manage, and analyze your reading journey'
        };
    }
  };

  // Render active component content only (without their headers)
  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview />;
      case 'setBook':
        return <SetBook />;
      case 'progress':
        return <SetProgress />;
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
              {activeTab === 'setBook' && (
                <button
                  onClick={() => {
                    // This will trigger the create modal in SetBook component
                    const createEvent = new CustomEvent('openCreateModal');
                    document.dispatchEvent(createEvent);
                  }}
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center space-x-2"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Add Book</span>
                </button>
              )}
              
              <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50 rounded-lg">
                <BookOpenIcon className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Reading Dashboard</span>
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

export default Reading;