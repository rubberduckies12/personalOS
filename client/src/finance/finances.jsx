import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  CreditCardIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  FunnelIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CalendarIcon,
  XMarkIcon,
  HomeIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

const Finances = () => {
  const navigate = useNavigate();
  
  // State
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [budgets, setBudgets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [summary, setSummary] = useState({
    budgets: { active: 0, closed: 0, deleted: 0 },
    expenses: { total: 0, paid: 0, unpaid: 0, overdue: 0 },
    incomes: { total: 0, recurring: 0, oneTime: 0 }
  });
  const [filters, setFilters] = useState({
    category: 'all',
    currency: 'GBP',
    status: 'active',
    timeframe: '6m'
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState('budget');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for different types
  const [budgetForm, setBudgetForm] = useState({
    budgetName: '',
    amount: '',
    currency: 'GBP',
    category: 'General',
    description: '',
    isRecurring: false,
    frequency: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  });

  const [expenseForm, setExpenseForm] = useState({
    name: '',
    amount: '',
    currency: 'GBP',
    category: 'General',
    description: '',
    date: new Date().toISOString().split('T')[0],
    paymentStatus: 'unpaid',
    paidAmount: '0',
    paymentMethod: 'card',
    isRecurring: false,
    frequency: 'monthly'
  });

  const [incomeForm, setIncomeForm] = useState({
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

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (string) => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  };

  // Format currency
  const formatCurrency = (amount, currency = 'GBP') => {
    const symbols = { USD: '$', GBP: '£', EUR: '€' };
    return `${symbols[currency] || '£'}${parseFloat(amount || 0).toFixed(2)}`;
  };

  // Reset forms
  const resetForms = () => {
    setBudgetForm({
      budgetName: '',
      amount: '',
      currency: 'GBP',
      category: 'General',
      description: '',
      isRecurring: false,
      frequency: 'monthly',
      startDate: new Date().toISOString().split('T')[0],
      endDate: ''
    });

    setExpenseForm({
      name: '',
      amount: '',
      currency: 'GBP',
      category: 'General',
      description: '',
      date: new Date().toISOString().split('T')[0],
      paymentStatus: 'unpaid',
      paidAmount: '0',
      paymentMethod: 'card',
      isRecurring: false,
      frequency: 'monthly'
    });

    setIncomeForm({
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

  useEffect(() => {
    loadFinanceData();
  }, [filters]);

  const loadFinanceData = async () => {
    try {
      console.log('💰 Loading finance data with JWT...');
      
      // Get user data from localStorage
      const userData = localStorage.getItem('user');
      if (!userData) {
        console.log('❌ No user data found, redirecting to login');
        navigate('/auth/login');
        return;
      }

      // Get JWT token
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.error('❌ No access token found, redirecting to login');
        navigate('/auth/login');
        return;
      }

      setUser(JSON.parse(userData));
      console.log('🔐 Using JWT token:', token.substring(0, 20) + '...');

      // JWT-only headers (NO COOKIES)
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      console.log('📡 Making API requests with JWT headers...');

      // Fetch all financial data
      const [budgetsRes, expensesRes, incomesRes] = await Promise.all([
        fetch(`http://localhost:5001/api/finances/budgets?status=${filters.status}&currency=${filters.currency}&limit=10`, { 
          headers
          // Remove credentials: 'include' - no cookies
        }),
        fetch(`http://localhost:5001/api/finances/expenses?currency=${filters.currency}&limit=10`, { 
          headers
          // Remove credentials: 'include' - no cookies
        }),
        fetch(`http://localhost:5001/api/finances/income?currency=${filters.currency}&limit=10`, { 
          headers
          // Remove credentials: 'include' - no cookies
        })
      ]);

      console.log('📡 Budget response status:', budgetsRes.status);
      console.log('📡 Expenses response status:', expensesRes.status);
      console.log('📡 Income response status:', incomesRes.status);

      // Handle budgets response
      if (budgetsRes.status === 401) {
        console.log('🔒 Budgets request unauthorized, clearing auth and redirecting');
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
        return;
      }

      if (budgetsRes.ok) {
        const budgetsData = await budgetsRes.json();
        setBudgets(budgetsData.budgets || []);
        setSummary(prev => ({ ...prev, budgets: budgetsData.summary || prev.budgets }));
      } else {
        console.error('❌ Budgets request failed:', budgetsRes.status, await budgetsRes.text());
      }

      // Handle expenses response
      if (expensesRes.status === 401) {
        console.log('🔒 Expenses request unauthorized, clearing auth and redirecting');
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
        return;
      }

      if (expensesRes.ok) {
        const expensesData = await expensesRes.json();
        setExpenses(expensesData.expenses || []);
        setSummary(prev => ({ ...prev, expenses: expensesData.summary || prev.expenses }));
      } else {
        console.error('❌ Expenses request failed:', expensesRes.status, await expensesRes.text());
      }

      // Handle income response
      if (incomesRes.status === 401) {
        console.log('🔒 Income request unauthorized, clearing auth and redirecting');
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
        return;
      }

      if (incomesRes.ok) {
        const incomesData = await incomesRes.json();
        setIncomes(incomesData.incomes || []);
        setSummary(prev => ({ ...prev, incomes: incomesData.summary || prev.incomes }));
      } else {
        console.error('❌ Income request failed:', incomesRes.status, await incomesRes.text());
      }

      setLoading(false);
    } catch (error) {
      console.error('💥 Error loading finance data:', error);
      setLoading(false);
    }
  };

  // Handle form submissions
  const handleCreateBudget = async (e) => {
    console.log('🎯 BUDGET FORM SUBMIT TRIGGERED!');
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const userData = localStorage.getItem('user');
      const token = localStorage.getItem('accessToken');
      
      if (!userData || !token) {
        console.error('❌ Missing auth data, redirecting to login');
        navigate('/auth/login');
        return;
      }

      console.log('🔐 Using JWT token for budget creation:', token.substring(0, 20) + '...');
      console.log('📝 Budget form data:', budgetForm);

      const response = await fetch('http://localhost:5001/api/finances/budgets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        // Remove credentials: 'include' - no cookies
        body: JSON.stringify(budgetForm)
      });

      console.log('📡 Budget creation response status:', response.status);

      if (response.status === 401) {
        console.log('🔒 Budget creation unauthorized, clearing auth and redirecting');
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
        return;
      }

      if (response.ok) {
        const newBudget = await response.json();
        console.log('✅ Budget created successfully:', newBudget);
        setBudgets(prev => [newBudget.budget, ...prev]);
        setShowCreateModal(false);
        resetForms();
        loadFinanceData();
      } else {
        const errorText = await response.text();
        console.error('❌ Budget creation failed:', response.status, errorText);
        try {
          const error = JSON.parse(errorText);
          alert(error.error || 'Failed to create budget');
        } catch {
          alert(`Server error: ${response.status} - ${errorText}`);
        }
      }
    } catch (error) {
      console.error('💥 Network error creating budget:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const userData = localStorage.getItem('user');
      const token = localStorage.getItem('accessToken');
      
      if (!userData || !token) {
        navigate('/auth/login');
        return;
      }

      const response = await fetch('http://localhost:5001/api/finances/expenses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        // Remove credentials: 'include' - no cookies
        body: JSON.stringify(expenseForm)
      });

      if (response.status === 401) {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
        return;
      }

      if (response.ok) {
        const newExpense = await response.json();
        setExpenses(prev => [newExpense.expense, ...prev]);
        setShowCreateModal(false);
        resetForms();
        loadFinanceData();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create expense');
      }
    } catch (error) {
      console.error('Error creating expense:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateIncome = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const userData = localStorage.getItem('user');
      const token = localStorage.getItem('accessToken');
      
      if (!userData || !token) {
        navigate('/auth/login');
        return;
      }

      const response = await fetch('http://localhost:5001/api/finances/income', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        // Remove credentials: 'include' - no cookies
        body: JSON.stringify(incomeForm)
      });

      if (response.status === 401) {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
        return;
      }

      if (response.ok) {
        const newIncome = await response.json();
        setIncomes(prev => [newIncome.income, ...prev]);
        setShowCreateModal(false);
        resetForms();
        loadFinanceData();
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'exceeded': return 'text-red-600 bg-red-100';
      case 'warning': return 'text-orange-600 bg-orange-100';
      case 'on-track': return 'text-green-600 bg-green-100';
      case 'paid': return 'text-green-600 bg-green-100';
      case 'unpaid': return 'text-red-600 bg-red-100';
      case 'partial': return 'text-orange-600 bg-orange-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'budgets', name: 'Budgets', icon: CurrencyDollarIcon },
    { id: 'expenses', name: 'Expenses', icon: CreditCardIcon },
    { id: 'income', name: 'Income', icon: BanknotesIcon }
  ];

  const categories = {
    budget: ['General', 'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 'Savings'],
    expense: ['General', 'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 'Personal Care'],
    income: ['Salary', 'Freelance', 'Investment', 'Business', 'Gift', 'Other']
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              {/* Back to Home Button */}
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <HomeIcon className="w-5 h-5" />
                <span className="font-medium">Dashboard</span>
              </button>
              
              <div className="border-l border-gray-300 h-6"></div>
              
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Financial Management
                </h1>
                <p className="text-sm text-gray-600">
                  Track budgets, expenses, and income
                </p>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setCreateType('budget');
                  setShowCreateModal(true);
                }}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-2 rounded-lg font-medium hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 flex items-center space-x-2"
              >
                <CurrencyDollarIcon className="w-5 h-5" />
                <span>Budget</span>
              </button>
              <button
                onClick={() => {
                  setCreateType('expense');
                  setShowCreateModal(true);
                }}
                className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-lg font-medium hover:from-red-600 hover:to-pink-600 transition-all duration-200 flex items-center space-x-2"
              >
                <CreditCardIcon className="w-5 h-5" />
                <span>Expense</span>
              </button>
              <button
                onClick={() => {
                  setCreateType('income');
                  setShowCreateModal(true);
                }}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center space-x-2"
              >
                <BanknotesIcon className="w-5 h-5" />
                <span>Income</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content - keeping existing tabs content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                    <CurrencyDollarIcon className="w-6 h-6 text-white" />
                  </div>
                  <ArrowTrendingUpIcon className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Active Budgets</h3>
                <p className="text-3xl font-bold text-gray-900">{summary.budgets.active}</p>
                <p className="text-sm text-gray-600">
                  {summary.budgets.closed} closed, {summary.budgets.deleted} archived
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <CreditCardIcon className="w-6 h-6 text-white" />
                  </div>
                  <ArrowTrendingDownIcon className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Expenses</h3>
                <p className="text-3xl font-bold text-gray-900">{summary.expenses.total}</p>
                <p className="text-sm text-gray-600">
                  {summary.expenses.paid} paid, {summary.expenses.overdue} overdue
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                    <BanknotesIcon className="w-6 h-6 text-white" />
                  </div>
                  <ArrowTrendingUpIcon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Income Sources</h3>
                <p className="text-3xl font-bold text-gray-900">{summary.incomes.total}</p>
                <p className="text-sm text-gray-600">
                  {summary.incomes.recurring} recurring, {summary.incomes.oneTime} one-time
                </p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Expenses</h3>
                <div className="space-y-3">
                  {expenses.slice(0, 5).map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                          <CreditCardIcon className="w-4 h-4 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{expense.name}</p>
                          <p className="text-xs text-gray-500">{expense.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(expense.amount, expense.currency)}
                        </p>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(expense.paymentStatus)}`}>
                          {expense.paymentStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Status</h3>
                <div className="space-y-3">
                  {budgets.slice(0, 5).map((budget) => (
                    <div key={budget.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900">{budget.budgetName}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(budget.status)}`}>
                          {budget.status}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                        <div
                          className={`h-2 rounded-full ${
                            budget.spentPercentage >= 100 ? 'bg-red-500' :
                            budget.spentPercentage >= 80 ? 'bg-orange-500' :
                            'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(budget.spentPercentage, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>{formatCurrency(budget.currentSpent, budget.currency)} spent</span>
                        <span>{formatCurrency(budget.amount, budget.currency)} budget</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Budgets Tab */}
        {activeTab === 'budgets' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex flex-wrap gap-4">
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="active">Active Budgets</option>
                  <option value="closed">Closed Budgets</option>
                  <option value="all">All Budgets</option>
                </select>
                
                <select
                  value={filters.currency}
                  onChange={(e) => setFilters(prev => ({ ...prev, currency: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="GBP">GBP (£)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>

            {/* Budgets List */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Budgets</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {budgets.map((budget) => (
                  <div key={budget.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">{budget.budgetName}</h4>
                        <p className="text-sm text-gray-600">{budget.category}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(budget.status)}`}>
                          {budget.status}
                        </span>
                        <div className="flex space-x-1">
                          <button className="p-2 text-gray-400 hover:text-blue-600">
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-emerald-600">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-red-600">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>{formatCurrency(budget.currentSpent, budget.currency)} spent</span>
                        <span>{budget.spentPercentage}% of {formatCurrency(budget.amount, budget.currency)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            budget.spentPercentage >= 100 ? 'bg-red-500' :
                            budget.spentPercentage >= 80 ? 'bg-orange-500' :
                            'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(budget.spentPercentage, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Remaining: {formatCurrency(budget.remainingAmount, budget.currency)}</span>
                      <span>
                        {budget.isRecurring ? `${budget.frequency} budget` : 'One-time budget'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Expenses Tab */}
        {activeTab === 'expenses' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex flex-wrap gap-4">
                <select
                  value={filters.currency}
                  onChange={(e) => setFilters(prev => ({ ...prev, currency: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="GBP">GBP (£)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
                
                <select
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="all">All Categories</option>
                  <option value="Food & Dining">Food & Dining</option>
                  <option value="Transportation">Transportation</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Bills & Utilities">Bills & Utilities</option>
                </select>
              </div>
            </div>

            {/* Expenses List */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Expenses</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {expenses.map((expense) => (
                  <div key={expense.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">{expense.name}</h4>
                        <p className="text-sm text-gray-600">{expense.category}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(expense.paymentStatus)}`}>
                          {expense.paymentStatus}
                        </span>
                        <div className="flex space-x-1">
                          <button className="p-2 text-gray-400 hover:text-blue-600">
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-emerald-600">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-red-600">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Amount</p>
                        <p className="font-medium text-gray-900">
                          {formatCurrency(expense.amount, expense.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Paid</p>
                        <p className="font-medium text-gray-900">
                          {formatCurrency(expense.paidAmount, expense.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Remaining</p>
                        <p className="font-medium text-gray-900">
                          {formatCurrency(expense.remainingBalance, expense.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Date</p>
                        <p className="font-medium text-gray-900">
                          {new Date(expense.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    {expense.description && (
                      <p className="text-sm text-gray-600 mt-3">{expense.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Income Tab */}
        {activeTab === 'income' && (
          <div className="space-y-6">
            {/* Income List */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Income Sources</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {incomes.map((income) => (
                  <div key={income.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">{income.source}</h4>
                        <p className="text-sm text-gray-600">{income.category}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          income.isRecurring ? 'text-blue-600 bg-blue-100' : 'text-gray-600 bg-gray-100'
                        }`}>
                          {income.isRecurring ? 'Recurring' : 'One-time'}
                        </span>
                        <div className="flex space-x-1">
                          <button className="p-2 text-gray-400 hover:text-blue-600">
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-emerald-600">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-red-600">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Amount</p>
                        <p className="font-medium text-gray-900">
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
                            {capitalizeFirstLetter(income.frequency)}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {income.description && (
                      <p className="text-sm text-gray-600 mt-3">{income.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* No Data States */}
        {((activeTab === 'budgets' && budgets.length === 0) ||
          (activeTab === 'expenses' && expenses.length === 0) ||
          (activeTab === 'income' && incomes.length === 0)) && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <CurrencyDollarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {activeTab} found
            </h3>
            <p className="text-gray-600 mb-6">
              Get started by creating your first {activeTab.slice(0, -1)}.
            </p>
            <button
              onClick={() => {
                setCreateType(activeTab === 'income' ? 'income' : activeTab.slice(0, -1));
                setShowCreateModal(true);
              }}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-3 rounded-lg font-medium hover:from-emerald-600 hover:to-teal-600 transition-all duration-200"
            >
              Create {capitalizeFirstLetter(activeTab.slice(0, -1))}
            </button>
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Create New {capitalizeFirstLetter(createType)}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForms();
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Budget Form */}
              {createType === 'budget' && (
                <form onSubmit={handleCreateBudget} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Budget Name</label>
                    <input
                      type="text"
                      value={budgetForm.budgetName}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, budgetName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                        value={budgetForm.amount}
                        onChange={(e) => setBudgetForm(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="500.00"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                      <select
                        value={budgetForm.currency}
                        onChange={(e) => setBudgetForm(prev => ({ ...prev, currency: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                      value={budgetForm.category}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      {categories.budget.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                      <input
                        type="date"
                        value={budgetForm.startDate}
                        onChange={(e) => setBudgetForm(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                      <input
                        type="date"
                        value={budgetForm.endDate}
                        onChange={(e) => setBudgetForm(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="budget-recurring"
                      checked={budgetForm.isRecurring}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, isRecurring: e.target.checked }))}
                      className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                    />
                    <label htmlFor="budget-recurring" className="ml-2 text-sm text-gray-700">
                      Recurring budget
                    </label>
                  </div>

                  {budgetForm.isRecurring && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                      <select
                        value={budgetForm.frequency}
                        onChange={(e) => setBudgetForm(prev => ({ ...prev, frequency: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={budgetForm.description}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      rows="3"
                      placeholder="Optional description..."
                    />
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        resetForms();
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? 'Creating...' : 'Create Budget'}
                    </button>
                  </div>
                </form>
              )}

              {/* Expense Form */}
              {createType === 'expense' && (
                <form onSubmit={handleCreateExpense} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Expense Name</label>
                    <input
                      type="text"
                      value={expenseForm.name}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="Grocery shopping"
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
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        placeholder="50.00"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                      <select
                        value={expenseForm.currency}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, currency: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                        value={expenseForm.category}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      >
                        {categories.expense.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                      <input
                        type="date"
                        value={expenseForm.date}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
                      <select
                        value={expenseForm.paymentStatus}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, paymentStatus: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      >
                        <option value="unpaid">Unpaid</option>
                        <option value="paid">Paid</option>
                        <option value="partial">Partially Paid</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Paid Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={expenseForm.paidAmount}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, paidAmount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      rows="3"
                      placeholder="Optional description..."
                    />
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        resetForms();
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? 'Creating...' : 'Create Expense'}
                    </button>
                  </div>
                </form>
              )}

              {/* Income Form */}
              {createType === 'income' && (
                <form onSubmit={handleCreateIncome} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Income Source</label>
                    <input
                      type="text"
                      value={incomeForm.source}
                      onChange={(e) => setIncomeForm(prev => ({ ...prev, source: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        value={incomeForm.amount}
                        onChange={(e) => setIncomeForm(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="3000.00"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                      <select
                        value={incomeForm.currency}
                        onChange={(e) => setIncomeForm(prev => ({ ...prev, currency: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        value={incomeForm.category}
                        onChange={(e) => setIncomeForm(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {categories.income.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                      <input
                        type="date"
                        value={incomeForm.date}
                        onChange={(e) => setIncomeForm(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="income-recurring"
                      checked={incomeForm.isRecurring}
                      onChange={(e) => setIncomeForm(prev => ({ ...prev, isRecurring: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="income-recurring" className="ml-2 text-sm text-gray-700">
                      Recurring income
                    </label>
                  </div>

                  {incomeForm.isRecurring && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                      <select
                        value={incomeForm.frequency}
                        onChange={(e) => setIncomeForm(prev => ({ ...prev, frequency: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      id="income-taxable"
                      checked={incomeForm.taxable}
                      onChange={(e) => setIncomeForm(prev => ({ ...prev, taxable: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="income-taxable" className="ml-2 text-sm text-gray-700">
                      Taxable income
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={incomeForm.description}
                      onChange={(e) => setIncomeForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows="3"
                      placeholder="Optional description..."
                    />
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        resetForms();
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? 'Creating...' : 'Create Income'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Finances;