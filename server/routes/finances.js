const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Budget = require('../models/budgetModel');
const Expense = require('../models/expenseModel');
const Income = require('../models/incomeModel');
const { authenticateUser } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateUser);

// ========================================
// BUDGET ROUTES
// ========================================

// GET /api/finances/budgets - Get all budgets with filtering
router.get('/budgets', async (req, res) => {
  try {
    const {
      status = 'active',
      category,
      currency,
      isRecurring,
      alertOnly = false,
      sort = 'date',
      order = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    // Build filter
    const filter = { userId: req.userId };
    
    switch (status) {
      case 'active':
        filter.isActive = true;
        filter.isClosed = false;
        filter.isDeleted = false;
        break;
      case 'closed':
        filter.isClosed = true;
        filter.isDeleted = false;
        break;
      case 'deleted':
        filter.isDeleted = true;
        break;
      case 'all':
        break;
      default:
        filter.isActive = true;
        filter.isClosed = false;
        filter.isDeleted = false;
    }

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (currency && currency !== 'all') {
      filter.currency = currency;
    }

    if (isRecurring !== undefined) {
      filter.isRecurring = isRecurring === 'true';
    }

    // Build sort
    const sortObj = {};
    switch (sort) {
      case 'amount':
        sortObj.amount = order === 'desc' ? -1 : 1;
        break;
      case 'spent':
        sortObj.currentSpent = order === 'desc' ? -1 : 1;
        break;
      case 'category':
        sortObj.category = order === 'desc' ? -1 : 1;
        break;
      case 'date':
        sortObj.date = order === 'desc' ? -1 : 1;
        sortObj.startDate = order === 'desc' ? -1 : 1;
        break;
      default:
        sortObj.createdAt = -1;
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [budgets, total] = await Promise.all([
      Budget.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Budget.countDocuments(filter)
    ]);

    // Filter alert-only results after population if needed
    let filteredBudgets = budgets;
    if (alertOnly === 'true') {
      filteredBudgets = budgets.filter(budget => {
        const spentPercentage = budget.amount > 0 
          ? Math.round((parseFloat(budget.currentSpent.toString()) / parseFloat(budget.amount.toString())) * 100)
          : 0;
        return spentPercentage >= (budget.alertThreshold || 80);
      });
    }

    // Enrich budgets with computed fields
    const enrichedBudgets = filteredBudgets.map(budget => {
      const amount = parseFloat(budget.amount.toString());
      const spent = parseFloat(budget.currentSpent.toString());
      const remaining = Math.max(0, amount - spent);
      const spentPercentage = amount > 0 ? Math.round((spent / amount) * 100) : 0;
      
      let status = 'on-track';
      if (budget.isDeleted) status = 'deleted';
      else if (budget.isClosed) status = 'closed';
      else if (!budget.isActive) status = 'inactive';
      else if (spentPercentage >= 100) status = 'exceeded';
      else if (spentPercentage >= (budget.alertThreshold || 80)) status = 'warning';

      return {
        ...budget,
        amount,
        currentSpent: spent,
        remainingAmount: remaining,
        spentPercentage,
        status,
        isExceeded: spent >= amount,
        shouldAlert: spentPercentage >= (budget.alertThreshold || 80) && budget.isActive && !budget.isClosed
      };
    });

    // Get summary statistics
    const summary = await getBudgetsSummary(req.userId);

    res.json({
      budgets: enrichedBudgets,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrev: parseInt(page) > 1
      },
      summary
    });

  } catch (error) {
    console.error('Error fetching budgets:', error);
    res.status(500).json({
      error: 'Failed to fetch budgets',
      code: 'FETCH_ERROR'
    });
  }
});

// GET /api/finances/budgets/:id - Get specific budget
router.get('/budgets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid budget ID',
        code: 'INVALID_ID'
      });
    }

    const budget = await Budget.findOne({
      _id: id,
      userId: req.userId
    });

    if (!budget) {
      return res.status(404).json({
        error: 'Budget not found',
        code: 'BUDGET_NOT_FOUND'
      });
    }

    // Get related expenses for this budget category
    const relatedExpenses = await Expense.find({
      userId: req.userId,
      category: budget.category,
      currency: budget.currency
    }).sort({ date: -1 }).limit(10).lean();

    res.json({
      ...budget.toJSON(),
      relatedExpenses: relatedExpenses.map(expense => ({
        ...expense,
        amount: parseFloat(expense.amount.toString()),
        paidAmount: parseFloat(expense.paidAmount.toString())
      }))
    });

  } catch (error) {
    console.error('Error fetching budget:', error);
    res.status(500).json({
      error: 'Failed to fetch budget',
      code: 'FETCH_ERROR'
    });
  }
});

// POST /api/finances/budgets - Create new budget
router.post('/budgets', async (req, res) => {
  try {
    const {
      budgetName,
      category,
      amount,
      currency = 'GBP',
      description = '',
      isRecurring = false,
      frequency,
      date,
      startDate,
      endDate,
      alertThreshold = 80
    } = req.body;

    // Validation
    const validationErrors = [];

    if (!budgetName || budgetName.trim().length < 2) {
      validationErrors.push('Budget name must be at least 2 characters long');
    }

    if (!category) {
      validationErrors.push('Budget category is required');
    }

    if (!amount || amount <= 0) {
      validationErrors.push('Budget amount must be greater than 0');
    }

    if (isRecurring) {
      if (!frequency) {
        validationErrors.push('Frequency is required for recurring budgets');
      }
      if (!startDate) {
        validationErrors.push('Start date is required for recurring budgets');
      }
    } else {
      if (!date) {
        validationErrors.push('Date is required for non-recurring budgets');
      }
    }

    if (endDate && startDate && new Date(endDate) <= new Date(startDate)) {
      validationErrors.push('End date must be after start date');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }

    // Create budget
    const budgetData = {
      userId: req.userId,
      budgetName: budgetName.trim(),
      category,
      amount,
      currency,
      description: description.trim(),
      isRecurring,
      alertThreshold
    };

    if (isRecurring) {
      budgetData.frequency = frequency;
      budgetData.startDate = new Date(startDate);
      if (endDate) budgetData.endDate = new Date(endDate);
    } else {
      budgetData.date = date ? new Date(date) : new Date();
    }

    const budget = new Budget(budgetData);
    await budget.save();

    res.status(201).json({
      message: 'Budget created successfully',
      code: 'BUDGET_CREATED',
      budget: budget.toJSON()
    });

  } catch (error) {
    console.error('Error creating budget:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }

    res.status(500).json({
      error: 'Failed to create budget',
      code: 'CREATE_ERROR'
    });
  }
});

// PUT /api/finances/budgets/:id - Update budget
router.put('/budgets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid budget ID',
        code: 'INVALID_ID'
      });
    }

    const budget = await Budget.findOne({
      _id: id,
      userId: req.userId
    });

    if (!budget) {
      return res.status(404).json({
        error: 'Budget not found',
        code: 'BUDGET_NOT_FOUND'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'budgetName', 'amount', 'description', 'alertThreshold',
      'isRecurring', 'frequency', 'endDate'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Validate amount
    if (updates.amount && updates.amount <= 0) {
      return res.status(400).json({
        error: 'Budget amount must be greater than 0',
        code: 'INVALID_AMOUNT'
      });
    }

    Object.assign(budget, updates);
    await budget.save();

    res.json({
      message: 'Budget updated successfully',
      code: 'BUDGET_UPDATED',
      budget: budget.toJSON()
    });

  } catch (error) {
    console.error('Error updating budget:', error);
    res.status(500).json({
      error: 'Failed to update budget',
      code: 'UPDATE_ERROR'
    });
  }
});

// DELETE /api/finances/budgets/:id - Delete budget
router.delete('/budgets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid budget ID',
        code: 'INVALID_ID'
      });
    }

    const budget = await Budget.findOne({
      _id: id,
      userId: req.userId
    });

    if (!budget) {
      return res.status(404).json({
        error: 'Budget not found',
        code: 'BUDGET_NOT_FOUND'
      });
    }

    await Budget.deleteOne({ _id: id });

    res.json({
      message: 'Budget deleted successfully',
      code: 'BUDGET_DELETED'
    });

  } catch (error) {
    console.error('Error deleting budget:', error);
    res.status(500).json({
      error: 'Failed to delete budget',
      code: 'DELETE_ERROR'
    });
  }
});

// ========================================
// EXPENSE ROUTES
// ========================================

// GET /api/finances/expenses - Get all expenses with filtering
router.get('/expenses', async (req, res) => {
  try {
    const {
      category,
      currency,
      isPaid,
      isOverdue,
      paymentStatus,
      startDate,
      endDate,
      sort = 'date',
      order = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    // Build filter
    const filter = { userId: req.userId };

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (currency && currency !== 'all') {
      filter.currency = currency;
    }

    if (isPaid !== undefined) {
      filter.isPaid = isPaid === 'true';
    }

    if (isOverdue === 'true') {
      filter.isOverdue = true;
    }

    if (paymentStatus && paymentStatus !== 'all') {
      switch (paymentStatus) {
        case 'paid':
          filter.isPaid = true;
          break;
        case 'unpaid':
          filter.isPaid = false;
          filter.paidAmount = 0;
          break;
        case 'partial':
          filter.isPaid = false;
          filter.paidAmount = { $gt: 0 };
          break;
        case 'overdue':
          filter.isOverdue = true;
          filter.isPaid = false;
          break;
      }
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Build sort
    const sortObj = {};
    switch (sort) {
      case 'amount':
        sortObj.amount = order === 'desc' ? -1 : 1;
        break;
      case 'category':
        sortObj.category = order === 'desc' ? -1 : 1;
        break;
      case 'date':
        sortObj.date = order === 'desc' ? -1 : 1;
        break;
      default:
        sortObj.date = -1;
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Expense.countDocuments(filter)
    ]);

    // Enrich expenses with computed fields
    const enrichedExpenses = expenses.map(expense => {
      const amount = parseFloat(expense.amount.toString());
      const paidAmount = parseFloat(expense.paidAmount.toString());
      const remainingBalance = Math.max(0, amount - paidAmount);
      const paymentPercentage = amount > 0 ? Math.round((paidAmount / amount) * 100) : 0;
      
      let paymentStatus = 'unpaid';
      if (paymentPercentage === 100) paymentStatus = 'paid';
      else if (paymentPercentage > 0) paymentStatus = 'partial';
      else if (expense.isOverdue) paymentStatus = 'overdue';

      return {
        ...expense,
        amount,
        paidAmount,
        remainingBalance,
        paymentPercentage,
        paymentStatus
      };
    });

    // Get summary statistics
    const summary = await getExpensesSummary(req.userId);

    res.json({
      expenses: enrichedExpenses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrev: parseInt(page) > 1
      },
      summary
    });

  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({
      error: 'Failed to fetch expenses',
      code: 'FETCH_ERROR'
    });
  }
});

// POST /api/finances/expenses - Create new expense
router.post('/expenses', async (req, res) => {
  try {
    const {
      name,
      category,
      amount,
      currency = 'GBP',
      description = '',
      date,
      isPaid = false,
      paidAmount = 0,
      isRecurring = false,
      frequency,
      nextDueDate
    } = req.body;

    // Validation
    const validationErrors = [];

    if (!name || name.trim().length < 2) {
      validationErrors.push('Expense name must be at least 2 characters long');
    }

    if (!category) {
      validationErrors.push('Expense category is required');
    }

    if (!amount || amount <= 0) {
      validationErrors.push('Expense amount must be greater than 0');
    }

    if (paidAmount < 0 || paidAmount > amount) {
      validationErrors.push('Paid amount cannot be negative or exceed total amount');
    }

    if (isRecurring && !frequency) {
      validationErrors.push('Frequency is required for recurring expenses');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }

    // Create expense
    const expenseData = {
      userId: req.userId,
      name: name.trim(),
      category,
      amount,
      currency,
      description: description.trim(),
      date: date ? new Date(date) : new Date(),
      isPaid,
      paidAmount,
      isRecurring
    };

    if (isRecurring) {
      expenseData.frequency = frequency;
      if (nextDueDate) {
        expenseData.nextDueDate = new Date(nextDueDate);
      }
    }

    const expense = new Expense(expenseData);
    await expense.save();

    res.status(201).json({
      message: 'Expense created successfully',
      code: 'EXPENSE_CREATED',
      expense: expense.toJSON()
    });

  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({
      error: 'Failed to create expense',
      code: 'CREATE_ERROR'
    });
  }
});

// PUT /api/finances/expenses/:id - Update expense
router.put('/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid expense ID',
        code: 'INVALID_ID'
      });
    }

    const expense = await Expense.findOne({
      _id: id,
      userId: req.userId
    });

    if (!expense) {
      return res.status(404).json({
        error: 'Expense not found',
        code: 'EXPENSE_NOT_FOUND'
      });
    }

    const allowedUpdates = [
      'name', 'amount', 'description', 'category', 'isPaid', 
      'paidAmount', 'date', 'isRecurring', 'frequency', 'nextDueDate'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    if (updates.amount && updates.amount <= 0) {
      return res.status(400).json({
        error: 'Expense amount must be greater than 0',
        code: 'INVALID_AMOUNT'
      });
    }

    Object.assign(expense, updates);
    await expense.save();

    res.json({
      message: 'Expense updated successfully',
      code: 'EXPENSE_UPDATED',
      expense: expense.toJSON()
    });

  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({
      error: 'Failed to update expense',
      code: 'UPDATE_ERROR'
    });
  }
});

// DELETE /api/finances/expenses/:id - Delete expense
router.delete('/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid expense ID',
        code: 'INVALID_ID'
      });
    }

    const expense = await Expense.findOne({
      _id: id,
      userId: req.userId
    });

    if (!expense) {
      return res.status(404).json({
        error: 'Expense not found',
        code: 'EXPENSE_NOT_FOUND'
      });
    }

    await Expense.deleteOne({ _id: id });

    res.json({
      message: 'Expense deleted successfully',
      code: 'EXPENSE_DELETED'
    });

  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({
      error: 'Failed to delete expense',
      code: 'DELETE_ERROR'
    });
  }
});

// PATCH /api/finances/expenses/:id/payment - Add partial payment
router.patch('/expenses/:id/payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentAmount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid expense ID',
        code: 'INVALID_ID'
      });
    }

    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({
        error: 'Payment amount must be greater than 0',
        code: 'INVALID_PAYMENT_AMOUNT'
      });
    }

    const expense = await Expense.findOne({
      _id: id,
      userId: req.userId
    });

    if (!expense) {
      return res.status(404).json({
        error: 'Expense not found',
        code: 'EXPENSE_NOT_FOUND'
      });
    }

    await expense.addPayment(paymentAmount);

    res.json({
      message: 'Payment added successfully',
      code: 'PAYMENT_ADDED',
      expense: expense.toJSON()
    });

  } catch (error) {
    console.error('Error adding payment:', error);
    res.status(500).json({
      error: error.message || 'Failed to add payment',
      code: 'PAYMENT_ERROR'
    });
  }
});

// ========================================
// INCOME ROUTES
// ========================================

// GET /api/finances/income - Get all income with filtering
router.get('/income', async (req, res) => {
  try {
    const {
      category,
      currency,
      isRecurring,
      startDate,
      endDate,
      sort = 'date',
      order = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    // Build filter
    const filter = { userId: req.userId };

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (currency && currency !== 'all') {
      filter.currency = currency;
    }

    if (isRecurring !== undefined) {
      filter.isRecurring = isRecurring === 'true';
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Build sort
    const sortObj = {};
    switch (sort) {
      case 'amount':
        sortObj.amount = order === 'desc' ? -1 : 1;
        break;
      case 'source':
        sortObj.source = order === 'desc' ? -1 : 1;
        break;
      case 'category':
        sortObj.category = order === 'desc' ? -1 : 1;
        break;
      case 'date':
        sortObj.date = order === 'desc' ? -1 : 1;
        break;
      default:
        sortObj.date = -1;
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [incomes, total] = await Promise.all([
      Income.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Income.countDocuments(filter)
    ]);

    // Enrich incomes with computed fields
    const enrichedIncomes = incomes.map(income => ({
      ...income,
      amount: parseFloat(income.amount.toString())
    }));

    // Get summary statistics
    const summary = await getIncomeSummary(req.userId);

    res.json({
      incomes: enrichedIncomes,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrev: parseInt(page) > 1
      },
      summary
    });

  } catch (error) {
    console.error('Error fetching incomes:', error);
    res.status(500).json({
      error: 'Failed to fetch incomes',
      code: 'FETCH_ERROR'
    });
  }
});

// POST /api/finances/income - Create new income
router.post('/income', async (req, res) => {
  try {
    const {
      source,
      category,
      amount,
      currency = 'GBP',
      description = '',
      date,
      isRecurring = false,
      frequency,
      taxable = true
    } = req.body;

    // Validation
    const validationErrors = [];

    if (!source || source.trim().length < 2) {
      validationErrors.push('Income source must be at least 2 characters long');
    }

    if (!category) {
      validationErrors.push('Income category is required');
    }

    if (!amount || amount <= 0) {
      validationErrors.push('Income amount must be greater than 0');
    }

    if (isRecurring && !frequency) {
      validationErrors.push('Frequency is required for recurring income');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }

    // Create income
    const incomeData = {
      userId: req.userId,
      source: source.trim(),
      category,
      amount,
      currency,
      description: description.trim(),
      date: date ? new Date(date) : new Date(),
      isRecurring,
      taxable
    };

    if (isRecurring) {
      incomeData.frequency = frequency;
    }

    const income = new Income(incomeData);
    await income.save();

    res.status(201).json({
      message: 'Income created successfully',
      code: 'INCOME_CREATED',
      income: {
        ...income.toJSON(),
        amount: parseFloat(income.amount.toString())
      }
    });

  } catch (error) {
    console.error('Error creating income:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }

    res.status(500).json({
      error: 'Failed to create income',
      code: 'CREATE_ERROR'
    });
  }
});

// GET /api/finances/income/:id - Get specific income
router.get('/income/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid income ID',
        code: 'INVALID_ID'
      });
    }

    const income = await Income.findOne({
      _id: id,
      userId: req.userId
    });

    if (!income) {
      return res.status(404).json({
        error: 'Income not found',
        code: 'INCOME_NOT_FOUND'
      });
    }

    res.json({
      ...income.toJSON(),
      amount: parseFloat(income.amount.toString())
    });

  } catch (error) {
    console.error('Error fetching income:', error);
    res.status(500).json({
      error: 'Failed to fetch income',
      code: 'FETCH_ERROR'
    });
  }
});

// PUT /api/finances/income/:id - Update income
router.put('/income/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid income ID',
        code: 'INVALID_ID'
      });
    }

    const income = await Income.findOne({
      _id: id,
      userId: req.userId
    });

    if (!income) {
      return res.status(404).json({
        error: 'Income not found',
        code: 'INCOME_NOT_FOUND'
      });
    }

    const allowedUpdates = [
      'source', 'amount', 'description', 'category', 'date',
      'isRecurring', 'frequency', 'nextDueDate'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    if (updates.amount && updates.amount <= 0) {
      return res.status(400).json({
        error: 'Income amount must be greater than 0',
        code: 'INVALID_AMOUNT'
      });
    }

    Object.assign(income, updates);
    await income.save();

    res.json({
      message: 'Income updated successfully',
      code: 'INCOME_UPDATED',
      income: {
        ...income.toJSON(),
        amount: parseFloat(income.amount.toString())
      }
    });

  } catch (error) {
    console.error('Error updating income:', error);
    res.status(500).json({
      error: 'Failed to update income',
      code: 'UPDATE_ERROR'
    });
  }
});

// DELETE /api/finances/income/:id - Delete income
router.delete('/income/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid income ID',
        code: 'INVALID_ID'
      });
    }

    const income = await Income.findOne({
      _id: id,
      userId: req.userId
    });

    if (!income) {
      return res.status(404).json({
        error: 'Income not found',
        code: 'INCOME_NOT_FOUND'
      });
    }

    await Income.deleteOne({ _id: id });

    res.json({
      message: 'Income deleted successfully',
      code: 'INCOME_DELETED'
    });

  } catch (error) {
    console.error('Error deleting income:', error);
    res.status(500).json({
      error: 'Failed to delete income',
      code: 'DELETE_ERROR'
    });
  }
});

// GET /api/finances/analytics/category-trends - Category spending over time
router.get('/analytics/category-trends', async (req, res) => {
  try {
    const { 
      timeframe = '6m', 
      currency = 'GBP',
      category 
    } = req.query;

    let startDate = new Date();
    switch (timeframe) {
      case '1m':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '3m':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '6m':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '12m':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 6);
    }

    const matchConditions = {
      userId: new mongoose.Types.ObjectId(req.userId),
      currency,
      date: { $gte: startDate },
      isPaid: true
    };

    if (category && category !== 'all') {
      matchConditions.category = category;
    }

    const categoryTrends = await Expense.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: {
            category: '$category',
            month: { $dateToString: { format: '%Y-%m', date: '$date' } }
          },
          totalSpent: { $sum: { $toDouble: '$paidAmount' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.month': 1, '_id.category': 1 } }
    ]);

    res.json({
      timeframe,
      currency,
      category: category || 'all',
      categoryTrends: categoryTrends.map(item => ({
        category: item._id.category,
        month: item._id.month,
        totalSpent: item.totalSpent,
        transactionCount: item.count
      }))
    });

  } catch (error) {
    console.error('Error fetching category trends:', error);
    res.status(500).json({
      error: 'Failed to fetch category trends',
      code: 'ANALYTICS_ERROR'
    });
  }
});

// GET /api/finances/analytics/budget-performance - Budget vs actual spending
router.get('/analytics/budget-performance', async (req, res) => {
  try {
    const { currency = 'GBP', timeframe = '6m' } = req.query;

    let startDate = new Date();
    switch (timeframe) {
      case '1m':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '3m':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '6m':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 6);
    }

    const budgets = await Budget.find({
      userId: req.userId,
      currency,
      isActive: true,
      isDeleted: false,
      $or: [
        { date: { $gte: startDate } },
        { startDate: { $gte: startDate } }
      ]
    }).lean();

    const budgetPerformance = budgets.map(budget => {
      const budgetAmount = parseFloat(budget.amount.toString());
      const spent = parseFloat(budget.currentSpent.toString());
      const performance = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;
      
      return {
        budgetName: budget.budgetName,
        category: budget.category,
        budgeted: budgetAmount,
        spent,
        remaining: Math.max(0, budgetAmount - spent),
        performance,
        status: budget.status,
        isExceeded: spent >= budgetAmount
      };
    });

    res.json({
      currency,
      timeframe,
      budgetPerformance
    });

  } catch (error) {
    console.error('Error fetching budget performance:', error);
    res.status(500).json({
      error: 'Failed to fetch budget performance',
      code: 'ANALYTICS_ERROR'
    });
  }
});

// ========================================
// HELPER FUNCTIONS
// ========================================

async function getBudgetsSummary(userId) {
  try {
    const [active, closed, deleted] = await Promise.all([
      Budget.countDocuments({ userId, isActive: true, isClosed: false, isDeleted: false }),
      Budget.countDocuments({ userId, isClosed: true, isDeleted: false }),
      Budget.countDocuments({ userId, isDeleted: true })
    ]);

    return { active, closed, deleted };
  } catch (error) {
    console.error('Error calculating budgets summary:', error);
    return { active: 0, closed: 0, deleted: 0 };
  }
}

async function getExpensesSummary(userId) {
  try {
    const [total, paid, unpaid, overdue] = await Promise.all([
      Expense.countDocuments({ userId }),
      Expense.countDocuments({ userId, isPaid: true }),
      Expense.countDocuments({ userId, isPaid: false }),
      Expense.countDocuments({ userId, isOverdue: true, isPaid: false })
    ]);

    return { total, paid, unpaid, overdue };
  } catch (error) {
    console.error('Error calculating expenses summary:', error);
    return { total: 0, paid: 0, unpaid: 0, overdue: 0 };
  }
}

async function getIncomeSummary(userId) {
  try {
    const [total, recurring, oneTime] = await Promise.all([
      Income.countDocuments({ userId }),
      Income.countDocuments({ userId, isRecurring: true }),
      Income.countDocuments({ userId, isRecurring: false })
    ]);

    return { total, recurring, oneTime };
  } catch (error) {
    console.error('Error calculating income summary:', error);
    return { total: 0, recurring: 0, oneTime: 0 };
  }
}

async function getBudgetTotals(userId, currency) {
  try {
    const totals = await Budget.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          currency,
          isActive: true,
          isDeleted: false
        }
      },
      {
        $group: {
          _id: null,
          totalBudgeted: { $sum: { $toDecimal: '$amount' } }, // Use $toDecimal instead
          totalSpent: { $sum: { $toDecimal: '$currentSpent' } }
        }
      }
    ]);

    const result = totals[0] || { totalBudgeted: 0, totalSpent: 0 };
    return {
      totalBudgeted: parseFloat(result.totalBudgeted?.toString() || '0'),
      totalSpent: parseFloat(result.totalSpent?.toString() || '0')
    };
  } catch (error) {
    console.error('Error calculating budget totals:', error);
    return { totalBudgeted: 0, totalSpent: 0 };
  }
}

async function getExpenseTotals(userId, startDate, endDate, currency) {
  try {
    const totals = await Expense.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          currency,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: { $toDecimal: '$amount' } },
          totalPaid: { $sum: { $toDecimal: '$paidAmount' } }
        }
      }
    ]);

    const result = totals[0] || { totalAmount: 0, totalPaid: 0 };
    return {
      totalAmount: parseFloat(result.totalAmount?.toString() || '0'),
      totalPaid: parseFloat(result.totalPaid?.toString() || '0')
    };
  } catch (error) {
    console.error('Error calculating expense totals:', error);
    return { totalAmount: 0, totalPaid: 0 };
  }
}

async function getIncomeTotals(userId, startDate, endDate, currency) {
  try {
    const totals = await Income.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          currency,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: { $toDecimal: '$amount' } }
        }
      }
    ]);

    const result = totals[0] || { totalAmount: 0 };
    return {
      totalAmount: parseFloat(result.totalAmount?.toString() || '0')
    };
  } catch (error) {
    console.error('Error calculating income totals:', error);
    return { totalAmount: 0 };
  }
}

async function getCategoryBreakdown(userId, startDate, endDate, currency) {
  try {
    const breakdown = await Expense.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          currency,
          date: { $gte: startDate, $lte: endDate },
          isPaid: true
        }
      },
      {
        $group: {
          _id: '$category',
          totalSpent: { $sum: { $toDouble: '$paidAmount' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalSpent: -1 } }
    ]);

    return breakdown.map(item => ({
      category: item._id,
      totalSpent: item.totalSpent,
      transactionCount: item.count
    }));
  } catch (error) {
    console.error('Error calculating category breakdown:', error);
    return [];
  }
}

async function getTrendData(userId, startDate, endDate, currency) {
  try {
    const [expenseTrends, incomeTrends] = await Promise.all([
      Expense.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            currency,
            date: { $gte: startDate, $lte: endDate },
            isPaid: true
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            totalSpent: { $sum: { $toDouble: '$paidAmount' } }
          }
        },
        { $sort: { '_id': 1 } }
      ]),
      Income.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            currency,
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            totalIncome: { $sum: { $toDouble: '$amount' } }
          }
        },
        { $sort: { '_id': 1 } }
      ])
    ]);

    // Combine trends data
    const expenseMap = expenseTrends.reduce((acc, item) => {
      acc[item._id] = item.totalSpent;
      return acc;
    }, {});

    const incomeMap = incomeTrends.reduce((acc, item) => {
      acc[item._id] = item.totalIncome;
      return acc;
    }, {});

    // Get all unique dates
    const allDates = [...new Set([...Object.keys(expenseMap), ...Object.keys(incomeMap)])].sort();

    return allDates.map(date => ({
      date,
      totalSpent: expenseMap[date] || 0,
      totalIncome: incomeMap[date] || 0,
      netFlow: (incomeMap[date] || 0) - (expenseMap[date] || 0)
    }));
  } catch (error) {
    console.error('Error calculating trend data:', error);
    return [];
  }
}

// Add indexes to models
Budget.createIndexes();
Expense.createIndexes();
Income.createIndexes();

module.exports = router;