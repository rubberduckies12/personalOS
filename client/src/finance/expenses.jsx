import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  CreditCardIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

const Expenses = () => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    paid: 0,
    unpaid: 0,
    overdue: 0
  });
  const [filters, setFilters] = useState({
    category: 'all',
    currency: 'GBP',
    paymentStatus: 'all',
    timeframe: '6m'
  });
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [viewingExpense, setViewingExpense] = useState(null);
  const [paymentExpense, setPaymentExpense] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    amount: '',
    currency: 'GBP',
    category: 'General',
    description: '',
    date: new Date().toISOString().split('T')[0],
    isPaid: false,
    paidAmount: '0',
    isRecurring: false,
    frequency: 'monthly'
  });

  const [editForm, setEditForm] = useState({
    name: '',
    amount: '',
    currency: 'GBP',
    category: 'General',
    description: '',
    date: '',
    isPaid: false,
    paidAmount: '0',
    isRecurring: false,
    frequency: 'monthly'
  });

  const [paymentForm, setPaymentForm] = useState({
    paymentAmount: '',
    paymentMethod: 'card',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Categories
  const categories = ['General', 'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 'Personal Care'];

  // Format currency
  const formatCurrency = (amount, currency = 'GBP') => {
    const symbols = { USD: '$', GBP: '£', EUR: '€' };
    return `${symbols[currency] || '£'}${parseFloat(amount || 0).toFixed(2)}`;
  };

  // Get payment status info
  const getPaymentStatusInfo = (expense) => {
    const amount = parseFloat(expense.amount || 0);
    const paidAmount = parseFloat(expense.paidAmount || 0);
    const percentage = amount > 0 ? (paidAmount / amount) * 100 : 0;
    
    if (percentage >= 100) {
      return { status: 'paid', color: 'green', text: 'Paid' };
    } else if (percentage > 0) {
      return { status: 'partial', color: 'yellow', text: 'Partially Paid' };
    } else if (expense.isOverdue) {
      return { status: 'overdue', color: 'red', text: 'Overdue' };
    } else {
      return { status: 'unpaid', color: 'red', text: 'Unpaid' };
    }
  };

  // Reset forms
  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      amount: '',
      currency: 'GBP',
      category: 'General',
      description: '',
      date: new Date().toISOString().split('T')[0],
      isPaid: false,
      paidAmount: '0',
      isRecurring: false,
      frequency: 'monthly'
    });
  };

  const resetEditForm = () => {
    setEditForm({
      name: '',
      amount: '',
      currency: 'GBP',
      category: 'General',
      description: '',
      date: '',
      isPaid: false,
      paidAmount: '0',
      isRecurring: false,
      frequency: 'monthly'
    });
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      paymentAmount: '',
      paymentMethod: 'card',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
  };

  // Load expense data
  const loadExpenseData = async () => {
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

      if (filters.paymentStatus !== 'all') {
        params.append('paymentStatus', filters.paymentStatus);
      }

      const response = await fetch(`http://localhost:5001/api/finances/expenses?${params}`, {
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
        setExpenses(data.expenses || []);
        setSummary(data.summary || { total: 0, paid: 0, unpaid: 0, overdue: 0 });
      } else {
        console.error('Failed to load expense data:', response.status);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading expense data:', error);
      setLoading(false);
    }
  };

  // Create expense
  const handleCreateExpense = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const response = await fetch('http://localhost:5001/api/finances/expenses', {
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
        setExpenses(prev => [result.expense, ...prev]);
        setShowCreateModal(false);
        resetCreateForm();
        loadExpenseData(); // Refresh data
        console.log('✅ Expense created successfully');
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

  // Edit expense
  const handleEditExpense = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const expenseId = editingExpense.id || editingExpense._id;
      const response = await fetch(`http://localhost:5001/api/finances/expenses/${expenseId}`, {
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
        setExpenses(prev => prev.map(expense => 
          (expense.id || expense._id) === expenseId ? result.expense : expense
        ));
        setShowEditModal(false);
        setEditingExpense(null);
        resetEditForm();
        loadExpenseData(); // Refresh data
        console.log('✅ Expense updated successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update expense');
      }
    } catch (error) {
      console.error('Error updating expense:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mark as paid using edit endpoint
  const handleMarkAsPaid = async (expense) => {
    const remainingAmount = parseFloat(expense.amount) - parseFloat(expense.paidAmount || 0);
    
    if (remainingAmount <= 0) {
      alert('This expense is already fully paid.');
      return;
    }

    if (!window.confirm(`Mark this expense as fully paid? This will set the paid amount to ${formatCurrency(expense.amount, expense.currency)}.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const expenseId = expense.id || expense._id;
      
      // Use the edit endpoint instead of payment endpoint
      const response = await fetch(`http://localhost:5001/api/finances/expenses/${expenseId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          isPaid: true,
          paidAmount: parseFloat(expense.amount)
        })
      });

      if (response.status === 401) {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
        return;
      }

      if (response.ok) {
        const result = await response.json();
        setExpenses(prev => prev.map(exp => 
          (exp.id || exp._id) === expenseId ? result.expense : exp
        ));
        loadExpenseData(); // Refresh data
        console.log('✅ Expense marked as paid successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to mark as paid');
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
      alert('Network error. Please try again.');
    }
  };

  // Add payment
  const handleAddPayment = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const expenseId = paymentExpense.id || paymentExpense._id;
      const currentPaidAmount = parseFloat(paymentExpense.paidAmount || 0);
      const additionalPayment = parseFloat(paymentForm.paymentAmount);
      const newPaidAmount = currentPaidAmount + additionalPayment;
      const totalAmount = parseFloat(paymentExpense.amount);
      
      // Use the edit endpoint
      const response = await fetch(`http://localhost:5001/api/finances/expenses/${expenseId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          paidAmount: newPaidAmount,
          isPaid: newPaidAmount >= totalAmount
        })
      });

      if (response.status === 401) {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
        return;
      }

      if (response.ok) {
        const result = await response.json();
        setExpenses(prev => prev.map(expense => 
          (expense.id || expense._id) === expenseId ? result.expense : expense
        ));
        setShowPaymentModal(false);
        setPaymentExpense(null);
        resetPaymentForm();
        loadExpenseData(); // Refresh data
        console.log('✅ Payment added successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add payment');
      }
    } catch (error) {
      console.error('Error adding payment:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete expense
  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const response = await fetch(`http://localhost:5001/api/finances/expenses/${expenseId}`, {
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
        setExpenses(prev => prev.filter(expense => (expense.id || expense._id) !== expenseId));
        console.log('✅ Expense deleted successfully');
        loadExpenseData(); // Refresh data
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete expense');
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Network error. Please try again.');
    }
  };

  // Open modals
  const openEditModal = (expense) => {
    setEditingExpense(expense);
    setEditForm({
      name: expense.name,
      amount: expense.amount.toString(),
      currency: expense.currency,
      category: expense.category,
      description: expense.description || '',
      date: new Date(expense.date).toISOString().split('T')[0],
      isPaid: expense.isPaid,
      paidAmount: expense.paidAmount.toString(),
      isRecurring: expense.isRecurring,
      frequency: expense.frequency || 'monthly'
    });
    setShowEditModal(true);
  };

  const openViewModal = (expense) => {
    setViewingExpense(expense);
    setShowViewModal(true);
  };

  const openPaymentModal = (expense) => {
    setPaymentExpense(expense);
    const remainingAmount = parseFloat(expense.amount) - parseFloat(expense.paidAmount || 0);
    setPaymentForm(prev => ({
      ...prev,
      paymentAmount: remainingAmount.toString()
    }));
    setShowPaymentModal(true);
  };

  // Calculate totals
  const calculateTotals = () => {
    const totalAmount = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
    const paidAmount = expenses.reduce((sum, expense) => sum + parseFloat(expense.paidAmount || 0), 0);
    const remainingAmount = totalAmount - paidAmount;
    
    return {
      total: totalAmount,
      paid: paidAmount,
      remaining: remainingAmount,
      count: expenses.length,
      paidCount: expenses.filter(expense => parseFloat(expense.paidAmount || 0) >= parseFloat(expense.amount || 0)).length,
      unpaidCount: expenses.filter(expense => parseFloat(expense.paidAmount || 0) < parseFloat(expense.amount || 0)).length,
      overdueCount: expenses.filter(expense => expense.isOverdue).length
    };
  };

  useEffect(() => {
    loadExpenseData();
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
          {/* Total Expenses */}
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg flex items-center justify-center">
                <CreditCardIcon className="w-6 h-6 text-white" />
              </div>
              <ArrowTrendingDownIcon className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Expenses</h3>
            <p className="text-3xl font-bold text-red-600">{formatCurrency(totals.total, filters.currency)}</p>
            <div className="mt-3 text-sm text-gray-600">
              {totals.count} expense{totals.count !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Paid Expenses */}
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6 text-white" />
              </div>
              <ArrowTrendingUpIcon className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Paid Amount</h3>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(totals.paid, filters.currency)}</p>
            <div className="mt-3 text-sm text-gray-600">
              {totals.paidCount} paid expense{totals.paidCount !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Remaining */}
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                <ClockIcon className="w-6 h-6 text-white" />
              </div>
              <ExclamationTriangleIcon className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Remaining</h3>
            <p className="text-3xl font-bold text-orange-600">{formatCurrency(totals.remaining, filters.currency)}</p>
            <div className="mt-3 text-sm text-gray-600">
              {totals.unpaidCount} unpaid expense{totals.unpaidCount !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Payment Rate */}
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <CurrencyDollarIcon className="w-6 h-6 text-white" />
              </div>
              <InformationCircleIcon className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Payment Rate</h3>
            <p className="text-3xl font-bold text-blue-600">
              {totals.total > 0 ? ((totals.paid / totals.total) * 100).toFixed(1) : 0}%
            </p>
            <div className="mt-3 text-sm text-gray-600">
              {totals.overdueCount} overdue expense{totals.overdueCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-wrap gap-4">
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            <select
              value={filters.currency}
              onChange={(e) => setFilters(prev => ({ ...prev, currency: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="GBP">GBP (£)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>

            <select
              value={filters.paymentStatus}
              onChange={(e) => setFilters(prev => ({ ...prev, paymentStatus: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="all">All Payment Status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partially Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {/* Expenses List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Expenses</h3>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-lg font-medium hover:from-red-600 hover:to-pink-600 transition-all duration-200 flex items-center space-x-2"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Expense</span>
            </button>
          </div>
          
          <div className="divide-y divide-gray-200">
            {expenses.map((expense) => {
              const statusInfo = getPaymentStatusInfo(expense);
              const remainingAmount = parseFloat(expense.amount) - parseFloat(expense.paidAmount || 0);
              
              return (
                <div key={expense.id || expense._id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">{expense.name}</h4>
                      <p className="text-sm text-gray-600">{expense.category}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium text-${statusInfo.color}-600 bg-${statusInfo.color}-100`}>
                        {statusInfo.text}
                      </span>
                      {expense.isRecurring && (
                        <span className="px-2 py-1 rounded text-xs font-medium text-blue-600 bg-blue-100">
                          Recurring
                        </span>
                      )}
                      <div className="flex space-x-1">
                        <button 
                          onClick={() => openViewModal(expense)}
                          className="p-2 text-gray-400 hover:text-blue-600"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => openEditModal(expense)}
                          className="p-2 text-gray-400 hover:text-emerald-600"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteExpense(expense.id || expense._id)}
                          className="p-2 text-gray-400 hover:text-red-600"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-500">Total Amount</p>
                      <p className="font-medium text-red-600 text-lg">
                        {formatCurrency(expense.amount, expense.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Paid Amount</p>
                      <p className="font-medium text-green-600">
                        {formatCurrency(expense.paidAmount, expense.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Remaining</p>
                      <p className="font-medium text-orange-600">
                        {formatCurrency(remainingAmount, expense.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Date</p>
                      <p className="font-medium text-gray-900">
                        {new Date(expense.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3">
                    {remainingAmount > 0 && (
                      <>
                        <button
                          onClick={() => handleMarkAsPaid(expense)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center space-x-2"
                        >
                          <CheckCircleIcon className="w-4 h-4" />
                          <span>Mark as Paid</span>
                        </button>
                        <button
                          onClick={() => openPaymentModal(expense)}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2"
                        >
                          <BanknotesIcon className="w-4 h-4" />
                          <span>Add Payment</span>
                        </button>
                      </>
                    )}
                  </div>
                  
                  {expense.description && (
                    <p className="text-sm text-gray-600 mt-3 bg-gray-50 p-3 rounded-lg">
                      {expense.description}
                    </p>
                  )}
                </div>
              );
            })}

            {expenses.length === 0 && (
              <div className="p-12 text-center">
                <CreditCardIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No expenses found</h3>
                <p className="text-gray-600 mb-6">
                  Get started by adding your first expense.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-3 rounded-lg font-medium hover:from-red-600 hover:to-pink-600 transition-all duration-200"
                >
                  Add Expense
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
                <h3 className="text-xl font-semibold text-gray-900">Add New Expense</h3>
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

              <form onSubmit={handleCreateExpense} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expense Name</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
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
                      value={createForm.amount}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="50.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                    <select
                      value={createForm.currency}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, currency: e.target.value }))}
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
                      value={createForm.category}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="create-paid"
                    checked={createForm.isPaid}
                    onChange={(e) => setCreateForm(prev => ({ 
                      ...prev, 
                      isPaid: e.target.checked,
                      paidAmount: e.target.checked ? prev.amount : '0'
                    }))}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <label htmlFor="create-paid" className="ml-2 text-sm text-gray-700">
                    Already paid
                  </label>
                </div>

                {createForm.isPaid && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Paid Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={createForm.paidAmount}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, paidAmount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="0.00"
                    />
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="create-recurring"
                    checked={createForm.isRecurring}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, isRecurring: e.target.checked }))}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <label htmlFor="create-recurring" className="ml-2 text-sm text-gray-700">
                    Recurring expense
                  </label>
                </div>

                {createForm.isRecurring && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                    <select
                      value={createForm.frequency}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, frequency: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                    value={createForm.description}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
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
                      resetCreateForm();
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
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Edit Expense</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingExpense(null);
                    resetEditForm();
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleEditExpense} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expense Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
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
                      value={editForm.amount}
                      onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="50.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                    <select
                      value={editForm.currency}
                      onChange={(e) => setEditForm(prev => ({ ...prev, currency: e.target.value }))}
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
                      value={editForm.category}
                      onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Paid Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.paidAmount}
                    onChange={(e) => setEditForm(prev => ({ ...prev, paidAmount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit-recurring"
                    checked={editForm.isRecurring}
                    onChange={(e) => setEditForm(prev => ({ ...prev, isRecurring: e.target.checked }))}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <label htmlFor="edit-recurring" className="ml-2 text-sm text-gray-700">
                    Recurring expense
                  </label>
                </div>

                {editForm.isRecurring && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                    <select
                      value={editForm.frequency}
                      onChange={(e) => setEditForm(prev => ({ ...prev, frequency: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    rows="3"
                    placeholder="Optional description..."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingExpense(null);
                      resetEditForm();
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
                    {isSubmitting ? 'Updating...' : 'Update Expense'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Expense Details</h3>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingExpense(null);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Name</label>
                    <p className="text-lg font-semibold text-gray-900">{viewingExpense.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Amount</label>
                    <p className="text-lg font-semibold text-red-600">
                      {formatCurrency(viewingExpense.amount, viewingExpense.currency)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Category</label>
                    <p className="text-gray-900">{viewingExpense.category}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Date</label>
                    <p className="text-gray-900">{new Date(viewingExpense.date).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Paid Amount</label>
                    <p className="text-green-600 font-medium">
                      {formatCurrency(viewingExpense.paidAmount, viewingExpense.currency)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Remaining</label>
                    <p className="text-orange-600 font-medium">
                      {formatCurrency(parseFloat(viewingExpense.amount) - parseFloat(viewingExpense.paidAmount || 0), viewingExpense.currency)}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Payment Status</label>
                  <p className={`inline-flex px-2 py-1 rounded-full text-sm font-medium ${
                    getPaymentStatusInfo(viewingExpense).status === 'paid' 
                      ? 'text-green-600 bg-green-100' 
                      : getPaymentStatusInfo(viewingExpense).status === 'partial'
                      ? 'text-yellow-600 bg-yellow-100'
                      : 'text-red-600 bg-red-100'
                  }`}>
                    {getPaymentStatusInfo(viewingExpense).text}
                  </p>
                </div>

                {viewingExpense.isRecurring && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Frequency</label>
                    <p className="text-gray-900">
                      {viewingExpense.frequency ? viewingExpense.frequency.charAt(0).toUpperCase() + viewingExpense.frequency.slice(1) : 'Monthly'}
                    </p>
                  </div>
                )}

                {viewingExpense.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Description</label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded-lg mt-1">
                      {viewingExpense.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    openEditModal(viewingExpense);
                  }}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center space-x-2"
                >
                  <PencilIcon className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingExpense(null);
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

      {/* Payment Modal */}
      {showPaymentModal && paymentExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Add Payment</h3>
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentExpense(null);
                    resetPaymentForm();
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900">{paymentExpense.name}</h4>
                <div className="flex justify-between text-sm text-gray-600 mt-1">
                  <span>Total: {formatCurrency(paymentExpense.amount, paymentExpense.currency)}</span>
                  <span>Paid: {formatCurrency(paymentExpense.paidAmount, paymentExpense.currency)}</span>
                </div>
                <div className="text-sm text-orange-600 mt-1">
                  Remaining: {formatCurrency(parseFloat(paymentExpense.amount) - parseFloat(paymentExpense.paidAmount || 0), paymentExpense.currency)}
                </div>
              </div>

              <form onSubmit={handleAddPayment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={parseFloat(paymentExpense.amount) - parseFloat(paymentExpense.paidAmount || 0)}
                    value={paymentForm.paymentAmount}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentAmount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="card">Credit/Debit Card</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="check">Check</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date</label>
                  <input
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    rows="2"
                    placeholder="Optional payment notes..."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPaymentModal(false);
                      setPaymentExpense(null);
                      resetPaymentForm();
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
                    {isSubmitting ? 'Adding...' : 'Add Payment'}
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

export default Expenses;