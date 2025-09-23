import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChartPieIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';

const Budget = () => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState([]);
  const [filters, setFilters] = useState({
    category: 'all',
    currency: 'GBP',
    status: 'active'
  });
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [contributingBudget, setContributingBudget] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    budgetName: '',
    amount: '',
    currency: 'GBP',
    category: 'General',
    description: '',
    alertThreshold: '80'
  });

  const [editForm, setEditForm] = useState({
    budgetName: '',
    amount: '',
    currency: 'GBP',
    category: 'General',
    description: '',
    alertThreshold: '80'
  });

  const [contributeForm, setContributeForm] = useState({
    contributionAmount: '',
    contributionType: 'add', // 'add' or 'spend'
    description: ''
  });

  const categories = ['General', 'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 'Savings'];

  const formatCurrency = (amount, currency = 'GBP') => {
    const symbols = { USD: '$', GBP: '£', EUR: '€' };
    return `${symbols[currency] || '£'}${parseFloat(amount || 0).toFixed(2)}`;
  };

  const getBudgetStatusInfo = (budget) => {
    const percentage = parseFloat(budget.amount) > 0 ? (parseFloat(budget.currentSpent || 0) / parseFloat(budget.amount)) * 100 : 0;
    
    if (percentage >= 100) {
      return { status: 'exceeded', color: 'red', text: 'Exceeded' };
    } else if (percentage >= (budget.alertThreshold || 80)) {
      return { status: 'warning', color: 'orange', text: 'Warning' };
    } else {
      return { status: 'on-track', color: 'green', text: 'On Track' };
    }
  };

  const resetForms = () => {
    setCreateForm({
      budgetName: '',
      amount: '',
      currency: 'GBP',
      category: 'General',
      description: '',
      alertThreshold: '80'
    });
    setEditForm({
      budgetName: '',
      amount: '',
      currency: 'GBP',
      category: 'General',
      description: '',
      alertThreshold: '80'
    });
    setContributeForm({
      contributionAmount: '',
      contributionType: 'add',
      description: ''
    });
  };

  const loadBudgetData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const params = new URLSearchParams({
        status: filters.status,
        currency: filters.currency,
        limit: '50'
      });

      if (filters.category !== 'all') {
        params.append('category', filters.category);
      }

      const response = await fetch(`http://localhost:5001/api/finances/budgets?${params}`, {
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
        setBudgets(data.budgets || []);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading budget data:', error);
      setLoading(false);
    }
  };

  const handleCreateBudget = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:5001/api/finances/budgets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createForm)
      });

      if (response.ok) {
        setShowCreateModal(false);
        resetForms();
        loadBudgetData();
        console.log('✅ Budget created successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create budget');
      }
    } catch (error) {
      console.error('Error creating budget:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditBudget = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      const budgetId = editingBudget.id || editingBudget._id;
      const response = await fetch(`http://localhost:5001/api/finances/budgets/${budgetId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        setShowEditModal(false);
        setEditingBudget(null);
        resetForms();
        loadBudgetData();
        console.log('✅ Budget updated successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update budget');
      }
    } catch (error) {
      console.error('Error updating budget:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContributeToBudget = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      const budgetId = contributingBudget.id || contributingBudget._id;
      const contributionAmount = parseFloat(contributeForm.contributionAmount);
      
      let endpoint, method, body;
      
      if (contributeForm.contributionType === 'add') {
        // Add money to budget (increase budget amount)
        endpoint = `http://localhost:5001/api/finances/budgets/${budgetId}`;
        method = 'PUT';
        const newAmount = parseFloat(contributingBudget.amount) + contributionAmount;
        body = JSON.stringify({ 
          amount: newAmount,
          description: `${contributingBudget.description || ''}\n[${new Date().toLocaleDateString()}] Added ${formatCurrency(contributionAmount, contributingBudget.currency)}: ${contributeForm.description}`.trim()
        });
      } else {
        // Spend from budget (increase currentSpent)
        endpoint = `http://localhost:5001/api/finances/budgets/${budgetId}/spend`;
        method = 'PATCH';
        body = JSON.stringify({ 
          spendAmount: contributionAmount,
          description: contributeForm.description
        });
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body
      });

      if (response.ok) {
        setShowContributeModal(false);
        setContributingBudget(null);
        resetForms();
        loadBudgetData();
        console.log(`✅ Budget ${contributeForm.contributionType === 'add' ? 'contribution' : 'spending'} recorded successfully`);
      } else {
        const error = await response.json();
        alert(error.error || `Failed to record ${contributeForm.contributionType === 'add' ? 'contribution' : 'spending'}`);
      }
    } catch (error) {
      console.error('Error contributing to budget:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBudget = async (budgetId) => {
    if (!window.confirm('Are you sure you want to delete this budget?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:5001/api/finances/budgets/${budgetId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        loadBudgetData();
        console.log('✅ Budget deleted successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete budget');
      }
    } catch (error) {
      console.error('Error deleting budget:', error);
      alert('Network error. Please try again.');
    }
  };

  const openEditModal = (budget) => {
    setEditingBudget(budget);
    setEditForm({
      budgetName: budget.budgetName,
      amount: budget.amount.toString(),
      currency: budget.currency,
      category: budget.category,
      description: budget.description || '',
      alertThreshold: (budget.alertThreshold || 80).toString()
    });
    setShowEditModal(true);
  };

  const openContributeModal = (budget) => {
    setContributingBudget(budget);
    resetForms();
    setShowContributeModal(true);
  };

  const calculateTotals = () => {
    const totalBudget = budgets.reduce((sum, budget) => sum + parseFloat(budget.amount || 0), 0);
    const totalSpent = budgets.reduce((sum, budget) => sum + parseFloat(budget.currentSpent || 0), 0);
    const totalRemaining = totalBudget - totalSpent;
    
    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      activeCount: budgets.filter(budget => budget.isActive && !budget.isClosed && !budget.isDeleted).length,
      exceededCount: budgets.filter(budget => {
        const percentage = parseFloat(budget.amount) > 0 ? (parseFloat(budget.currentSpent) / parseFloat(budget.amount)) * 100 : 0;
        return percentage >= 100;
      }).length,
      warningCount: budgets.filter(budget => {
        const percentage = parseFloat(budget.amount) > 0 ? (parseFloat(budget.currentSpent) / parseFloat(budget.amount)) * 100 : 0;
        return percentage >= (budget.alertThreshold || 80) && percentage < 100;
      }).length
    };
  };

  useEffect(() => {
    loadBudgetData();
  }, [filters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const totals = calculateTotals();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <CurrencyDollarIcon className="w-6 h-6 text-white" />
              </div>
              <ArrowTrendingUpIcon className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Budget</h3>
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(totals.totalBudget, filters.currency)}</p>
            <div className="mt-3 text-sm text-gray-600">
              {totals.activeCount} active budget{totals.activeCount !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg flex items-center justify-center">
                <ChartPieIcon className="w-6 h-6 text-white" />
              </div>
              <ArrowTrendingDownIcon className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Spent</h3>
            <p className="text-3xl font-bold text-red-600">{formatCurrency(totals.totalSpent, filters.currency)}</p>
            <div className="mt-3 text-sm text-gray-600">
              {totals.totalBudget > 0 ? ((totals.totalSpent / totals.totalBudget) * 100).toFixed(1) : 0}% of budget
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <BanknotesIcon className="w-6 h-6 text-white" />
              </div>
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Remaining</h3>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(totals.totalRemaining, filters.currency)}</p>
            <div className="mt-3 text-sm text-gray-600">Available to spend</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                <ExclamationTriangleIcon className="w-6 h-6 text-white" />
              </div>
              <InformationCircleIcon className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Budget Alerts</h3>
            <p className="text-3xl font-bold text-orange-600">{totals.exceededCount + totals.warningCount}</p>
            <div className="mt-3 text-sm text-gray-600">
              {totals.exceededCount} exceeded, {totals.warningCount} warnings
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-wrap gap-4">
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="active">Active Budgets</option>
              <option value="closed">Closed Budgets</option>
              <option value="all">All Budgets</option>
            </select>
            
            <select
              value={filters.currency}
              onChange={(e) => setFilters(prev => ({ ...prev, currency: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="GBP">GBP (£)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>

            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Budgets List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Budgets</h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center space-x-2"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Budget</span>
            </button>
          </div>
          <div className="divide-y divide-gray-200">
            {budgets.map((budget) => {
              const statusInfo = getBudgetStatusInfo(budget);
              const percentage = Math.min((parseFloat(budget.currentSpent || 0) / parseFloat(budget.amount)) * 100, 100);
              const remaining = Math.max(0, parseFloat(budget.amount) - parseFloat(budget.currentSpent || 0));
              
              return (
                <div key={budget.id || budget._id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">{budget.budgetName}</h4>
                      <p className="text-sm text-gray-600">{budget.category}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium text-${statusInfo.color}-600 bg-${statusInfo.color}-100`}>
                        {statusInfo.text}
                      </span>
                      <div className="flex space-x-1">
                        <button 
                          onClick={() => openEditModal(budget)}
                          className="p-2 text-gray-400 hover:text-emerald-600"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteBudget(budget.id || budget._id)}
                          className="p-2 text-gray-400 hover:text-red-600"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>{formatCurrency(budget.currentSpent || 0, budget.currency)} spent</span>
                      <span>{percentage.toFixed(1)}% of {formatCurrency(budget.amount, budget.currency)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${
                          percentage >= 100 ? 'bg-red-500' :
                          percentage >= (budget.alertThreshold || 80) ? 'bg-orange-500' :
                          'bg-emerald-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-500">Total Budget</p>
                      <p className="font-medium text-blue-600 text-lg">
                        {formatCurrency(budget.amount, budget.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Spent</p>
                      <p className="font-medium text-red-600">
                        {formatCurrency(budget.currentSpent || 0, budget.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Remaining</p>
                      <p className="font-medium text-green-600">
                        {formatCurrency(remaining, budget.currency)}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3">
                    <button
                      onClick={() => openContributeModal(budget)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2"
                    >
                      <BanknotesIcon className="w-4 h-4" />
                      <span>Contribute</span>
                    </button>
                    <button
                      onClick={() => {
                        setContributingBudget(budget);
                        setContributeForm(prev => ({ ...prev, contributionType: 'spend' }));
                        setShowContributeModal(true);
                      }}
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center space-x-2"
                    >
                      <ChartPieIcon className="w-4 h-4" />
                      <span>Record Spend</span>
                    </button>
                  </div>
                  
                  {budget.description && (
                    <p className="text-sm text-gray-600 mt-3 bg-gray-50 p-3 rounded-lg">
                      {budget.description}
                    </p>
                  )}
                </div>
              );
            })}

            {budgets.length === 0 && (
              <div className="p-12 text-center">
                <CurrencyDollarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No budgets found</h3>
                <p className="text-gray-600 mb-6">Get started by creating your first budget.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 transition-all duration-200"
                >
                  Create Budget
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Create New Budget</h3>
                <button onClick={() => { setShowCreateModal(false); resetForms(); }} className="p-2 text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateBudget} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Budget Name</label>
                  <input
                    type="text"
                    value={createForm.budgetName}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, budgetName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Monthly Groceries"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={createForm.amount}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="500.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                    <select
                      value={createForm.currency}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="GBP">GBP (£)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Alert Threshold (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={createForm.alertThreshold}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, alertThreshold: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="80"
                  />
                  <p className="text-xs text-gray-500 mt-1">Alert when spending reaches this percentage</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Optional description..."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowCreateModal(false); resetForms(); }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Budget'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingBudget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Edit Budget</h3>
                <button onClick={() => { setShowEditModal(false); setEditingBudget(null); resetForms(); }} className="p-2 text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleEditBudget} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Budget Name</label>
                  <input
                    type="text"
                    value={editForm.budgetName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, budgetName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.amount}
                      onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                    <select
                      value={editForm.currency}
                      onChange={(e) => setEditForm(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="GBP">GBP (£)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Alert Threshold (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editForm.alertThreshold}
                    onChange={(e) => setEditForm(prev => ({ ...prev, alertThreshold: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); setEditingBudget(null); resetForms(); }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Updating...' : 'Update Budget'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Contribute Modal */}
      {showContributeModal && contributingBudget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  {contributeForm.contributionType === 'add' ? 'Add Money to Budget' : 'Record Spending'}
                </h3>
                <button onClick={() => { setShowContributeModal(false); setContributingBudget(null); resetForms(); }} className="p-2 text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900">{contributingBudget.budgetName}</h4>
                <div className="flex justify-between text-sm text-gray-600 mt-1">
                  <span>Budget: {formatCurrency(contributingBudget.amount, contributingBudget.currency)}</span>
                  <span>Spent: {formatCurrency(contributingBudget.currentSpent || 0, contributingBudget.currency)}</span>
                </div>
                <div className="text-sm text-green-600 mt-1">
                  Remaining: {formatCurrency(parseFloat(contributingBudget.amount) - parseFloat(contributingBudget.currentSpent || 0), contributingBudget.currency)}
                </div>
              </div>

              <form onSubmit={handleContributeToBudget} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Action Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setContributeForm(prev => ({ ...prev, contributionType: 'add' }))}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        contributeForm.contributionType === 'add'
                          ? 'bg-green-50 border-green-500 text-green-700'
                          : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Add Money
                    </button>
                    <button
                      type="button"
                      onClick={() => setContributeForm(prev => ({ ...prev, contributionType: 'spend' }))}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        contributeForm.contributionType === 'spend'
                          ? 'bg-orange-50 border-orange-500 text-orange-700'
                          : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Record Spend
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {contributeForm.contributionType === 'add' ? 'Amount to Add' : 'Amount Spent'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={contributeForm.contributionAmount}
                    onChange={(e) => setContributeForm(prev => ({ ...prev, contributionAmount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={contributeForm.description}
                    onChange={(e) => setContributeForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="2"
                    placeholder={`${contributeForm.contributionType === 'add' ? 'Why are you adding money?' : 'What did you spend on?'}`}
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowContributeModal(false); setContributingBudget(null); resetForms(); }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                      contributeForm.contributionType === 'add'
                        ? 'bg-green-500 hover:bg-green-600'
                        : 'bg-orange-500 hover:bg-orange-600'
                    }`}
                  >
                    {isSubmitting 
                      ? (contributeForm.contributionType === 'add' ? 'Adding...' : 'Recording...')
                      : (contributeForm.contributionType === 'add' ? 'Add Money' : 'Record Spend')
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Budget;