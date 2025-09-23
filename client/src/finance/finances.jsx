import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BanknotesIcon,
  CreditCardIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

// Import components
import Income from './income';
import Expenses from './expenses';
import Budget from './budget';
import FinancialOverview from './overview';

const Finances = () => {
  const navigate = useNavigate();
  
  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState({
    currency: 'GBP'
  });

  // Navigation tabs
  const tabs = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'income', name: 'Income', icon: BanknotesIcon },
    { id: 'expenses', name: 'Expenses', icon: CreditCardIcon },
    { id: 'budget', name: 'Budget', icon: CurrencyDollarIcon }
  ];

  // Get tab-specific header content
  const getHeaderContent = () => {
    switch (activeTab) {
      case 'overview':
        return {
          title: 'Financial Overview',
          subtitle: 'Complete analysis of your financial health'
        };
      case 'income':
        return {
          title: 'Income Management',
          subtitle: 'Track and manage your income sources'
        };
      case 'expenses':
        return {
          title: 'Expense Tracking',
          subtitle: 'Monitor and categorize your expenses'
        };
      case 'budget':
        return {
          title: 'Budget Management',
          subtitle: 'Create and manage your budgets'
        };
      default:
        return {
          title: 'Financial Center',
          subtitle: 'Manage your finances, budgets, income, and expenses'
        };
    }
  };

  // Render active component content only (without their headers)
  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'overview':
        return <FinancialOverview filters={filters} />;
      case 'income':
        return <Income />;
      case 'expenses':
        return <Expenses />;
      case 'budget':
        return <Budget />;
      default:
        return <FinancialOverview filters={filters} />;
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
              <select
                value={filters.currency}
                onChange={(e) => setFilters(prev => ({ ...prev, currency: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="GBP">GBP (£)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
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

export default Finances;