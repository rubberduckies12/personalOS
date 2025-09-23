import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BanknotesIcon,
  CreditCardIcon,
  CurrencyDollarIcon,
  ChartPieIcon,
  PresentationChartLineIcon,
  ArrowTrendingUpIcon as TrendingUpIcon,
  ArrowTrendingDownIcon as TrendingDownIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

const FinancialOverview = ({ filters: parentFilters }) => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
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

  // Format currency
  const formatCurrency = (amount, currency = 'GBP') => {
    const symbols = { USD: '$', GBP: '£', EUR: '€' };
    return `${symbols[currency] || '£'}${parseFloat(amount || 0).toFixed(2)}`;
  };

  // Calculate comprehensive financial totals
  const calculateTotals = () => {
    const totalBudgetAmount = budgets.reduce((sum, budget) => sum + parseFloat(budget.amount || 0), 0);
    const totalBudgetSpent = budgets.reduce((sum, budget) => sum + parseFloat(budget.currentSpent || 0), 0);
    const totalBudgetRemaining = totalBudgetAmount - totalBudgetSpent;
    
    const totalExpenseAmount = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
    const totalExpensePaid = expenses.reduce((sum, expense) => sum + parseFloat(expense.paidAmount || 0), 0);
    const totalExpenseRemaining = totalExpenseAmount - totalExpensePaid;
    
    const totalIncomeAmount = incomes.reduce((sum, income) => sum + parseFloat(income.amount || 0), 0);
    const recurringIncome = incomes.filter(income => income.isRecurring).reduce((sum, income) => sum + parseFloat(income.amount || 0), 0);
    const oneTimeIncome = totalIncomeAmount - recurringIncome;
    
    const netBalance = totalIncomeAmount - totalExpenseAmount;
    const savingsRate = totalIncomeAmount > 0 ? ((totalIncomeAmount - totalExpenseAmount) / totalIncomeAmount * 100) : 0;
    
    // Budget adherence rate
    const budgetAdherenceRate = totalBudgetAmount > 0 ? Math.max(0, 100 - ((totalBudgetSpent / totalBudgetAmount) * 100)) : 100;
    
    // Expense payment rate
    const expensePaymentRate = totalExpenseAmount > 0 ? (totalExpensePaid / totalExpenseAmount) * 100 : 100;
    
    // Emergency fund ratio (assuming 3-6 months of expenses is ideal)
    const monthlyExpenses = totalExpenseAmount / 6; // Rough estimate
    const emergencyFundMonths = monthlyExpenses > 0 ? netBalance / monthlyExpenses : 0;
    
    return {
      budgets: { total: totalBudgetAmount, spent: totalBudgetSpent, remaining: totalBudgetRemaining },
      expenses: { total: totalExpenseAmount, paid: totalExpensePaid, remaining: totalExpenseRemaining },
      income: { total: totalIncomeAmount, recurring: recurringIncome, oneTime: oneTimeIncome },
      netBalance,
      savingsRate,
      budgetAdherenceRate,
      expensePaymentRate,
      emergencyFundMonths
    };
  };

  // Improved Financial Health Calculator
  const calculateFinancialHealth = () => {
    const totals = calculateTotals();
    
    // Scoring components (0-100 each)
    let scores = {
      savingsRate: 0,
      budgetControl: 0,
      paymentDiscipline: 0,
      emergencyFund: 0,
      cashFlow: 0
    };
    
    // 1. Savings Rate Score (25% weight)
    if (totals.savingsRate >= 20) scores.savingsRate = 100;
    else if (totals.savingsRate >= 15) scores.savingsRate = 85;
    else if (totals.savingsRate >= 10) scores.savingsRate = 70;
    else if (totals.savingsRate >= 5) scores.savingsRate = 50;
    else if (totals.savingsRate > 0) scores.savingsRate = 30;
    else scores.savingsRate = 0;
    
    // 2. Budget Control Score (20% weight)
    if (totals.budgetAdherenceRate >= 90) scores.budgetControl = 100;
    else if (totals.budgetAdherenceRate >= 80) scores.budgetControl = 85;
    else if (totals.budgetAdherenceRate >= 70) scores.budgetControl = 70;
    else if (totals.budgetAdherenceRate >= 60) scores.budgetControl = 50;
    else if (totals.budgetAdherenceRate >= 50) scores.budgetControl = 30;
    else scores.budgetControl = 10;
    
    // 3. Payment Discipline Score (20% weight)
    if (totals.expensePaymentRate >= 95) scores.paymentDiscipline = 100;
    else if (totals.expensePaymentRate >= 85) scores.paymentDiscipline = 85;
    else if (totals.expensePaymentRate >= 75) scores.paymentDiscipline = 70;
    else if (totals.expensePaymentRate >= 65) scores.paymentDiscipline = 50;
    else if (totals.expensePaymentRate >= 50) scores.paymentDiscipline = 30;
    else scores.paymentDiscipline = 10;
    
    // 4. Emergency Fund Score (20% weight)
    if (totals.emergencyFundMonths >= 6) scores.emergencyFund = 100;
    else if (totals.emergencyFundMonths >= 3) scores.emergencyFund = 80;
    else if (totals.emergencyFundMonths >= 2) scores.emergencyFund = 60;
    else if (totals.emergencyFundMonths >= 1) scores.emergencyFund = 40;
    else if (totals.emergencyFundMonths > 0) scores.emergencyFund = 20;
    else scores.emergencyFund = 0;
    
    // 5. Cash Flow Score (15% weight)
    if (totals.netBalance > 0) {
      const cashFlowRatio = totals.netBalance / totals.income.total;
      if (cashFlowRatio >= 0.3) scores.cashFlow = 100;
      else if (cashFlowRatio >= 0.2) scores.cashFlow = 85;
      else if (cashFlowRatio >= 0.1) scores.cashFlow = 70;
      else if (cashFlowRatio >= 0.05) scores.cashFlow = 50;
      else scores.cashFlow = 30;
    } else {
      scores.cashFlow = 0;
    }
    
    // Calculate weighted score
    const totalScore = (
      scores.savingsRate * 0.25 +
      scores.budgetControl * 0.20 +
      scores.paymentDiscipline * 0.20 +
      scores.emergencyFund * 0.20 +
      scores.cashFlow * 0.15
    );
    
    // Determine health level and recommendations
    let healthLevel, recommendations, color;
    
    if (totalScore >= 85) {
      healthLevel = "Excellent";
      color = "emerald";
      recommendations = [
        "Consider increasing investment portfolio",
        "Look into tax optimization strategies",
        "Review insurance coverage annually"
      ];
    } else if (totalScore >= 70) {
      healthLevel = "Good";
      color = "green";
      recommendations = [
        "Build emergency fund to 6 months",
        "Increase savings rate to 20%",
        "Consider debt consolidation"
      ];
    } else if (totalScore >= 55) {
      healthLevel = "Fair";
      color = "yellow";
      recommendations = [
        "Create a strict budget plan",
        "Focus on paying off high-interest debt",
        "Build emergency fund to 3 months"
      ];
    } else if (totalScore >= 40) {
      healthLevel = "Poor";
      color = "orange";
      recommendations = [
        "Review all expenses immediately",
        "Consider additional income sources",
        "Seek financial counseling"
      ];
    } else {
      healthLevel = "Critical";
      color = "red";
      recommendations = [
        "Create emergency budget plan",
        "Contact creditors about payment plans",
        "Seek professional financial help immediately"
      ];
    }
    
    return {
      totalScore,
      scores,
      healthLevel,
      recommendations,
      color,
      totals
    };
  };

  // Get status color for various elements
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

  // Load financial data
  const loadFinanceData = async () => {
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

      const [budgetsRes, expensesRes, incomesRes] = await Promise.all([
        fetch(`http://localhost:5001/api/finances/budgets?status=active&currency=${filters.currency}&limit=50`, { headers }),
        fetch(`http://localhost:5001/api/finances/expenses?currency=${filters.currency}&limit=50`, { headers }),
        fetch(`http://localhost:5001/api/finances/income?currency=${filters.currency}&limit=50`, { headers })
      ]);

      if (budgetsRes.ok) {
        const budgetsData = await budgetsRes.json();
        setBudgets(budgetsData.budgets || []);
      }

      if (expensesRes.ok) {
        const expensesData = await expensesRes.json();
        setExpenses(expensesData.expenses || []);
      }

      if (incomesRes.ok) {
        const incomesData = await incomesRes.json();
        setIncomes(incomesData.incomes || []);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading finance data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinanceData();
  }, [filters.currency]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const financialHealth = calculateFinancialHealth();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Financial Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(() => {
            const totals = financialHealth.totals;
            return (
              <>
                {/* Total Income */}
                <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                      <BanknotesIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center space-x-1">
                      <TrendingUpIcon className="w-5 h-5 text-green-600" />
                      <span className="text-xs text-green-600 font-medium">
                        {totals.income.recurring > 0 ? 'Stable' : 'Variable'}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Income</h3>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(totals.income.total, filters.currency)}</p>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Recurring:</span>
                      <span className="font-medium">{formatCurrency(totals.income.recurring, filters.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>One-time:</span>
                      <span className="font-medium">{formatCurrency(totals.income.oneTime, filters.currency)}</span>
                    </div>
                  </div>
                </div>

                {/* Total Expenses */}
                <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-red-500 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg flex items-center justify-center">
                      <CreditCardIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center space-x-1">
                      <TrendingDownIcon className="w-5 h-5 text-red-600" />
                      <span className="text-xs text-red-600 font-medium">
                        {(totals.expenses.paid / totals.expenses.total * 100).toFixed(0)}% Paid
                      </span>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Expenses</h3>
                  <p className="text-3xl font-bold text-red-600">{formatCurrency(totals.expenses.total, filters.currency)}</p>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Paid:</span>
                      <span className="font-medium text-green-600">{formatCurrency(totals.expenses.paid, filters.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Remaining:</span>
                      <span className="font-medium text-red-600">{formatCurrency(totals.expenses.remaining, filters.currency)}</span>
                    </div>
                  </div>
                </div>

                {/* Budget Overview */}
                <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                      <CurrencyDollarIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center space-x-1">
                      <ChartPieIcon className="w-5 h-5 text-blue-600" />
                      <span className="text-xs text-blue-600 font-medium">
                        {totals.budgetAdherenceRate.toFixed(0)}% Control
                      </span>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Budget Allocated</h3>
                  <p className="text-3xl font-bold text-blue-600">{formatCurrency(totals.budgets.total, filters.currency)}</p>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Spent:</span>
                      <span className="font-medium text-orange-600">{formatCurrency(totals.budgets.spent, filters.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Remaining:</span>
                      <span className="font-medium text-blue-600">{formatCurrency(totals.budgets.remaining, filters.currency)}</span>
                    </div>
                  </div>
                </div>

                {/* Net Balance */}
                <div className={`bg-white rounded-xl shadow-sm p-6 border-l-4 ${totals.netBalance >= 0 ? 'border-emerald-500' : 'border-orange-500'} hover:shadow-md transition-shadow`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 bg-gradient-to-r ${totals.netBalance >= 0 ? 'from-emerald-500 to-teal-500' : 'from-orange-500 to-red-500'} rounded-lg flex items-center justify-center`}>
                      <PresentationChartLineIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center space-x-1">
                      {totals.netBalance >= 0 ? 
                        <TrendingUpIcon className="w-5 h-5 text-emerald-600" /> :
                        <TrendingDownIcon className="w-5 h-5 text-orange-600" />
                      }
                      <span className={`text-xs font-medium ${totals.netBalance >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {totals.savingsRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Net Balance</h3>
                  <p className={`text-3xl font-bold ${totals.netBalance >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                    {formatCurrency(totals.netBalance, filters.currency)}
                  </p>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Savings Rate:</span>
                      <span className="font-medium">{totals.savingsRate.toFixed(1)}%</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {totals.netBalance >= 0 ? 'Positive cash flow' : 'Negative cash flow'}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Financial Health Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Health Score Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <CheckCircleIcon className="w-5 h-5 mr-2 text-blue-600" />
              Financial Health Score
            </h3>
            
            <div className="text-center mb-6">
              <div className={`text-6xl font-bold mb-2 text-${financialHealth.color}-600`}>
                {financialHealth.totalScore.toFixed(0)}
              </div>
              <div className={`text-lg font-medium text-${financialHealth.color}-600`}>
                {financialHealth.healthLevel}
              </div>
            </div>

            {/* Health Score Breakdown */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Savings Rate</span>
                  <span>{financialHealth.scores.savingsRate.toFixed(0)}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-600"
                    style={{ width: `${financialHealth.scores.savingsRate}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Budget Control</span>
                  <span>{financialHealth.scores.budgetControl.toFixed(0)}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                    style={{ width: `${financialHealth.scores.budgetControl}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Payment Discipline</span>
                  <span>{financialHealth.scores.paymentDiscipline.toFixed(0)}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-green-400 to-green-600"
                    style={{ width: `${financialHealth.scores.paymentDiscipline}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Emergency Fund</span>
                  <span>{financialHealth.scores.emergencyFund.toFixed(0)}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-orange-600"
                    style={{ width: `${financialHealth.scores.emergencyFund}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Cash Flow</span>
                  <span>{financialHealth.scores.cashFlow.toFixed(0)}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-purple-400 to-purple-600"
                    style={{ width: `${financialHealth.scores.cashFlow}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <InformationCircleIcon className="w-5 h-5 mr-2 text-blue-600" />
              Recommendations
            </h3>
            
            <div className="space-y-3">
              {financialHealth.recommendations.map((recommendation, index) => (
                <div key={index} className={`p-3 rounded-lg border-l-4 border-${financialHealth.color}-500 bg-${financialHealth.color}-50`}>
                  <p className="text-sm text-gray-700">{recommendation}</p>
                </div>
              ))}
            </div>

            {/* Emergency Fund Status */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Emergency Fund Status</h4>
              <p className="text-sm text-blue-700">
                You have {financialHealth.totals.emergencyFundMonths.toFixed(1)} months of expenses covered.
                {financialHealth.totals.emergencyFundMonths < 3 && " Consider building to 3-6 months."}
                {financialHealth.totals.emergencyFundMonths >= 6 && " Excellent emergency fund coverage!"}
              </p>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <ChartBarIcon className="w-5 h-5 mr-2 text-blue-600" />
              Key Financial Metrics
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Debt-to-Income Ratio</span>
                <span className="font-medium">
                  {((financialHealth.totals.expenses.total / financialHealth.totals.income.total) * 100 || 0).toFixed(1)}%
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Savings Rate</span>
                <span className={`font-medium ${financialHealth.totals.savingsRate >= 20 ? 'text-green-600' : financialHealth.totals.savingsRate >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {financialHealth.totals.savingsRate.toFixed(1)}%
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Budget Adherence</span>
                <span className={`font-medium ${financialHealth.totals.budgetAdherenceRate >= 80 ? 'text-green-600' : financialHealth.totals.budgetAdherenceRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {financialHealth.totals.budgetAdherenceRate.toFixed(1)}%
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Payment Rate</span>
                <span className={`font-medium ${financialHealth.totals.expensePaymentRate >= 90 ? 'text-green-600' : financialHealth.totals.expensePaymentRate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {financialHealth.totals.expensePaymentRate.toFixed(1)}%
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Emergency Fund</span>
                <span className={`font-medium ${financialHealth.totals.emergencyFundMonths >= 3 ? 'text-green-600' : financialHealth.totals.emergencyFundMonths >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {financialHealth.totals.emergencyFundMonths.toFixed(1)} months
                </span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Monthly Cash Flow</h4>
              <div className="flex justify-between text-sm">
                <span>Net Monthly Flow:</span>
                <span className={`font-medium ${financialHealth.totals.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(financialHealth.totals.netBalance / 6, filters.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Budget Utilization Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <ChartPieIcon className="w-5 h-5 mr-2 text-blue-600" />
              Budget Utilization
            </h3>
            <div className="space-y-4">
              {budgets.slice(0, 5).map((budget) => {
                const percentage = Math.min((budget.currentSpent / budget.amount) * 100, 100);
                return (
                  <div key={budget.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-900">{budget.budgetName}</span>
                      <span className="text-gray-600">{percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${
                          percentage >= 100 ? 'bg-red-500' :
                          percentage >= 80 ? 'bg-orange-500' :
                          percentage >= 60 ? 'bg-yellow-500' :
                          'bg-emerald-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{formatCurrency(budget.currentSpent, budget.currency)} spent</span>
                      <span>{formatCurrency(budget.amount - budget.currentSpent, budget.currency)} left</span>
                    </div>
                  </div>
                );
              })}
              {budgets.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CurrencyDollarIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>No budgets created yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Expense Categories Breakdown */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CreditCardIcon className="w-5 h-5 mr-2 text-red-600" />
              Expense Categories
            </h3>
            <div className="space-y-4">
              {(() => {
                const categoryTotals = expenses.reduce((acc, expense) => {
                  acc[expense.category] = (acc[expense.category] || 0) + parseFloat(expense.amount || 0);
                  return acc;
                }, {});
                
                const totalExpenses = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0);
                
                return Object.entries(categoryTotals)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 6)
                  .map(([category, amount]) => {
                    const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-900">{category}</span>
                          <span className="text-gray-600">{formatCurrency(amount, filters.currency)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-red-400 to-pink-500 transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 text-right">
                          {percentage.toFixed(1)}% of total expenses
                        </div>
                      </div>
                    );
                  });
              })()}
              {expenses.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CreditCardIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>No expenses recorded yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Financial Activity</h3>
          <div className="space-y-3">
            {[
              ...expenses.slice(0, 3).map((expense, idx) => ({
                ...expense,
                type: 'expense',
                icon: CreditCardIcon,
                color: 'red',
                amount: -parseFloat(expense.amount || 0),
                uniqueKey: `expense-${expense.id || expense._id || idx}`
              })),
              ...incomes.slice(0, 3).map((income, idx) => ({
                ...income,
                type: 'income',
                icon: BanknotesIcon,
                color: 'green',
                amount: parseFloat(income.amount || 0),
                name: income.source,
                uniqueKey: `income-${income.id || income._id || idx}`
              }))
            ]
            .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
            .slice(0, 5)
            .map((item) => (
              <div key={item.uniqueKey} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 bg-${item.color}-100 rounded-full flex items-center justify-center`}>
                    <item.icon className={`w-4 h-4 text-${item.color}-600`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.name || item.source}</p>
                    <p className="text-xs text-gray-500">
                      {item.category} • {new Date(item.date || item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(item.amount), item.currency)}
                  </p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    item.type === 'expense' ? getStatusColor(item.paymentStatus) : 'text-green-600 bg-green-100'
                  }`}>
                    {item.type === 'expense' ? item.paymentStatus : 'received'}
                  </span>
                </div>
              </div>
            ))}
            {expenses.length === 0 && incomes.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <ChartBarIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default FinancialOverview;