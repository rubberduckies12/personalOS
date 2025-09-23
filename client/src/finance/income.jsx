import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

const Income = () => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [incomes, setIncomes] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    recurring: 0,
    oneTime: 0
  });
  const [filters, setFilters] = useState({
    category: 'all',
    currency: 'GBP',
    isRecurring: 'all',
    timeframe: '6m'
  });
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [viewingIncome, setViewingIncome] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    source: '',
    amount: '',
    currency: 'GBP',
    category: 'Salary',
    description: '',
    date: new Date().toISOString().split('T')[0],
    isRecurring: false,
    frequency: 'monthly',
    taxable: true
  });

  const [editForm, setEditForm] = useState({
    source: '',
    amount: '',
    currency: 'GBP',
    category: 'Salary',
    description: '',
    date: '',
    isRecurring: false,
    frequency: 'monthly',
    taxable: true
  });

  // Categories
  const categories = ['Salary', 'Freelance', 'Investment', 'Business', 'Gift', 'Bonus', 'Rental', 'Other'];

  // Format currency
  const formatCurrency = (amount, currency = 'GBP') => {
    const symbols = { USD: '$', GBP: '£', EUR: '€' };
    return `${symbols[currency] || '£'}${parseFloat(amount || 0).toFixed(2)}`;
  };

  // Reset forms
  const resetCreateForm = () => {
    setCreateForm({
      source: '',
      amount: '',
      currency: 'GBP',
      category: 'Salary',
      description: '',
      date: new Date().toISOString().split('T')[0],
      isRecurring: false,
      frequency: 'monthly',
      taxable: true
    });
  };

  const resetEditForm = () => {
    setEditForm({
      source: '',
      amount: '',
      currency: 'GBP',
      category: 'Salary',
      description: '',
      date: '',
      isRecurring: false,
      frequency: 'monthly',
      taxable: true
    });
  };

  // Load income data
  const loadIncomeData = async () => {
    try {
      setLoading(true);
      
      const userData = localStorage.getItem('user');
      const token = localStorage.getItem('accessToken');
      
      if (!userData || !token) {
        navigate('/auth/login');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Build query parameters
      const params = new URLSearchParams({
        currency: filters.currency,
        limit: '50'
      });

      if (filters.category !== 'all') {
        params.append('category', filters.category);
      }

      if (filters.isRecurring !== 'all') {
        params.append('isRecurring', filters.isRecurring);
      }

      const response = await fetch(`http://localhost:5001/api/finances/income?${params}`, {
        headers
      });

      if (response.status === 401) {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setIncomes(data.incomes || []);
        setSummary(data.summary || { total: 0, recurring: 0, oneTime: 0 });
      } else {
        console.error('Failed to load income data:', response.status);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading income data:', error);
      setLoading(false);
    }
  };

  // Create income
  const handleCreateIncome = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const response = await fetch('http://localhost:5001/api/finances/income', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createForm)
      });

      if (response.status === 401) {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
        return;
      }

      if (response.ok) {
        const result = await response.json();
        setIncomes(prev => [result.income, ...prev]);
        setShowCreateModal(false);
        resetCreateForm();
        loadIncomeData(); // Refresh data
        console.log('✅ Income created successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create income');
      }
    } catch (error) {
      console.error('Error creating income:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit income
  const handleEditIncome = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const incomeId = editingIncome.id || editingIncome._id;
      const response = await fetch(`http://localhost:5001/api/finances/income/${incomeId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });

      if (response.status === 401) {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
        return;
      }

      if (response.ok) {
        const result = await response.json();
        setIncomes(prev => prev.map(income => 
          (income.id || income._id) === incomeId ? result.income : income
        ));
        setShowEditModal(false);
        setEditingIncome(null);
        resetEditForm();
        loadIncomeData(); // Refresh data
        console.log('✅ Income updated successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update income');
      }
    } catch (error) {
      console.error('Error updating income:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete income
  const handleDeleteIncome = async (incomeId) => {
    if (!window.confirm('Are you sure you want to delete this income? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const response = await fetch(`http://localhost:5001/api/finances/income/${incomeId}`, {
        method: 'DELETE',
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
        setIncomes(prev => prev.filter(income => (income.id || income._id) !== incomeId));
        console.log('✅ Income deleted successfully');
        loadIncomeData(); // Refresh data
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete income');
      }
    } catch (error) {
      console.error('Error deleting income:', error);
      alert('Network error. Please try again.');
    }
  };

  // Open edit modal
  const openEditModal = (income) => {
    setEditingIncome(income);
    setEditForm({
      source: income.source,
      amount: income.amount.toString(),
      currency: income.currency,
      category: income.category,
      description: income.description || '',
      date: new Date(income.date).toISOString().split('T')[0],
      isRecurring: income.isRecurring,
      frequency: income.frequency || 'monthly',
      taxable: income.taxable
    });
    setShowEditModal(true);
  };

  // Open view modal
  const openViewModal = (income) => {
    setViewingIncome(income);
    setShowViewModal(true);
  };

  // Calculate totals
  const calculateTotals = () => {
    const totalAmount = incomes.reduce((sum, income) => sum + parseFloat(income.amount || 0), 0);
    const recurringAmount = incomes.filter(income => income.isRecurring).reduce((sum, income) => sum + parseFloat(income.amount || 0), 0);
    const oneTimeAmount = totalAmount - recurringAmount;
    
    return {
      total: totalAmount,
      recurring: recurringAmount,
      oneTime: oneTimeAmount,
      count: incomes.length,
      recurringCount: incomes.filter(income => income.isRecurring).length,
      oneTimeCount: incomes.filter(income => !income.isRecurring).length
    };
  };

  useEffect(() => {
    loadIncomeData();
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Income */}
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <BanknotesIcon className="w-6 h-6 text-white" />
              </div>
              <ArrowTrendingUpIcon className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Income</h3>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(totals.total, filters.currency)}</p>
            <div className="mt-3 text-sm text-gray-600">
              {totals.count} income source{totals.count !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Recurring Income */}
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <ClockIcon className="w-6 h-6 text-white" />
              </div>
              <CheckCircleIcon className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Recurring Income</h3>
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(totals.recurring, filters.currency)}</p>
            <div className="mt-3 text-sm text-gray-600">
              {totals.recurringCount} recurring source{totals.recurringCount !== 1 ? 's' : ''}
            </div>
          </div>

          {/* One-time Income */}
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <CurrencyDollarIcon className="w-6 h-6 text-white" />
              </div>
              <InformationCircleIcon className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">One-time Income</h3>
            <p className="text-3xl font-bold text-purple-600">{formatCurrency(totals.oneTime, filters.currency)}</p>
            <div className="mt-3 text-sm text-gray-600">
              {totals.oneTimeCount} one-time source{totals.oneTimeCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-wrap gap-4">
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            <select
              value={filters.currency}
              onChange={(e) => setFilters(prev => ({ ...prev, currency: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="GBP">GBP (£)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>

            <select
              value={filters.isRecurring}
              onChange={(e) => setFilters(prev => ({ ...prev, isRecurring: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">All Types</option>
              <option value="true">Recurring Only</option>
              <option value="false">One-time Only</option>
            </select>
          </div>
        </div>

        {/* Income List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Income Sources</h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-lg font-medium hover:from-green-600 hover:to-emerald-600 transition-all duration-200 flex items-center space-x-2"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Income</span>
            </button>
          </div>
          
          <div className="divide-y divide-gray-200">
            {incomes.map((income) => (
              <div key={income.id || income._id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">{income.source}</h4>
                    <p className="text-sm text-gray-600">{income.category}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      income.isRecurring 
                        ? 'text-blue-600 bg-blue-100' 
                        : 'text-purple-600 bg-purple-100'
                    }`}>
                      {income.isRecurring ? 'Recurring' : 'One-time'}
                    </span>
                    {income.taxable && (
                      <span className="px-2 py-1 rounded text-xs font-medium text-orange-600 bg-orange-100">
                        Taxable
                      </span>
                    )}
                    <div className="flex space-x-1">
                      <button 
                        onClick={() => openViewModal(income)}
                        className="p-2 text-gray-400 hover:text-blue-600"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => openEditModal(income)}
                        className="p-2 text-gray-400 hover:text-emerald-600"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteIncome(income.id || income._id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Amount</p>
                    <p className="font-medium text-green-600 text-lg">
                      {formatCurrency(income.amount, income.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(income.date).toLocaleDateString()}
                    </p>
                  </div>
                  {income.isRecurring && (
                    <div>
                      <p className="text-gray-500">Frequency</p>
                      <p className="font-medium text-gray-900">
                        {income.frequency ? income.frequency.charAt(0).toUpperCase() + income.frequency.slice(1) : 'Monthly'}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-500">Currency</p>
                    <p className="font-medium text-gray-900">{income.currency}</p>
                  </div>
                </div>
                
                {income.description && (
                  <p className="text-sm text-gray-600 mt-3 bg-gray-50 p-3 rounded-lg">
                    {income.description}
                  </p>
                )}
              </div>
            ))}

            {incomes.length === 0 && (
              <div className="p-12 text-center">
                <BanknotesIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No income sources found</h3>
                <p className="text-gray-600 mb-6">
                  Get started by adding your first income source.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-lg font-medium hover:from-green-600 hover:to-emerald-600 transition-all duration-200"
                >
                  Add Income Source
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Add New Income</h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateIncome} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Income Source</label>
                  <input
                    type="text"
                    value={createForm.source}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, source: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Salary - Company Name"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="3000.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                    <select
                      value={createForm.currency}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="GBP">GBP (£)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                      value={createForm.category}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <input
                      type="date"
                      value={createForm.date}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="create-recurring"
                    checked={createForm.isRecurring}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, isRecurring: e.target.checked }))}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <label htmlFor="create-recurring" className="ml-2 text-sm text-gray-700">
                    Recurring income
                  </label>
                </div>

                {createForm.isRecurring && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                    <select
                      value={createForm.frequency}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, frequency: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="create-taxable"
                    checked={createForm.taxable}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, taxable: e.target.checked }))}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <label htmlFor="create-taxable" className="ml-2 text-sm text-gray-700">
                    Taxable income
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    rows="3"
                    placeholder="Optional description..."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      resetCreateForm();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Income'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingIncome && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Edit Income</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingIncome(null);
                    resetEditForm();
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleEditIncome} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Income Source</label>
                  <input
                    type="text"
                    value={editForm.source}
                    onChange={(e) => setEditForm(prev => ({ ...prev, source: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Salary - Company Name"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="3000.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                    <select
                      value={editForm.currency}
                      onChange={(e) => setEditForm(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="GBP">GBP (£)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <input
                      type="date"
                      value={editForm.date}
                      onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit-recurring"
                    checked={editForm.isRecurring}
                    onChange={(e) => setEditForm(prev => ({ ...prev, isRecurring: e.target.checked }))}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <label htmlFor="edit-recurring" className="ml-2 text-sm text-gray-700">
                    Recurring income
                  </label>
                </div>

                {editForm.isRecurring && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                    <select
                      value={editForm.frequency}
                      onChange={(e) => setEditForm(prev => ({ ...prev, frequency: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit-taxable"
                    checked={editForm.taxable}
                    onChange={(e) => setEditForm(prev => ({ ...prev, taxable: e.target.checked }))}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <label htmlFor="edit-taxable" className="ml-2 text-sm text-gray-700">
                    Taxable income
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    rows="3"
                    placeholder="Optional description..."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingIncome(null);
                      resetEditForm();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Updating...' : 'Update Income'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingIncome && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Income Details</h3>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingIncome(null);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Source</label>
                    <p className="text-lg font-semibold text-gray-900">{viewingIncome.source}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Amount</label>
                    <p className="text-lg font-semibold text-green-600">
                      {formatCurrency(viewingIncome.amount, viewingIncome.currency)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Category</label>
                    <p className="text-gray-900">{viewingIncome.category}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Date</label>
                    <p className="text-gray-900">{new Date(viewingIncome.date).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Type</label>
                    <p className={`inline-flex px-2 py-1 rounded-full text-sm font-medium ${
                      viewingIncome.isRecurring 
                        ? 'text-blue-600 bg-blue-100' 
                        : 'text-purple-600 bg-purple-100'
                    }`}>
                      {viewingIncome.isRecurring ? 'Recurring' : 'One-time'}
                    </p>
                  </div>
                  {viewingIncome.isRecurring && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Frequency</label>
                      <p className="text-gray-900">
                        {viewingIncome.frequency ? viewingIncome.frequency.charAt(0).toUpperCase() + viewingIncome.frequency.slice(1) : 'Monthly'}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Tax Status</label>
                  <p className={`inline-flex px-2 py-1 rounded text-sm font-medium ${
                    viewingIncome.taxable 
                      ? 'text-orange-600 bg-orange-100' 
                      : 'text-green-600 bg-green-100'
                  }`}>
                    {viewingIncome.taxable ? 'Taxable' : 'Tax-free'}
                  </p>
                </div>

                {viewingIncome.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Description</label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded-lg mt-1">
                      {viewingIncome.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    openEditModal(viewingIncome);
                  }}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center space-x-2"
                >
                  <PencilIcon className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingIncome(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Income;