import Expense from "../models/Expense.js";

// @desc    Get all expenses with optional filters
// @route   GET /api/expenses
// @access  Private
export const getExpenses = async (req, res, next) => {
  try {
    const { category, status, startDate, endDate, paymentMethod, search } = req.query;
    const query = {};

    if (category && category !== "all") query.category = category;
    if (status && status !== "all") query.status = status;
    if (paymentMethod && paymentMethod !== "all") query.paymentMethod = paymentMethod;

    if (startDate || endDate) {
      query.expenseDate = {};
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        query.expenseDate.$gte = s;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        query.expenseDate.$lte = e;
      }
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { expenseNumber: { $regex: search, $options: "i" } },
        { reference: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    const expenses = await Expense.find(query).sort({ expenseDate: -1 });

    const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const byCategory = {};
    expenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });

    res.status(200).json({
      success: true,
      data: expenses,
      metrics: {
        totalCount: expenses.length,
        totalAmount: Math.round(totalAmount * 100) / 100,
        byCategory,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create an expense
// @route   POST /api/expenses
// @access  Private
export const createExpense = async (req, res, next) => {
  try {
    const { title, category, amount, paymentMethod, expenseDate, reference, notes } = req.body;
    if (!title || !category || !amount) {
      return res.status(400).json({ success: false, message: "Title, category, and amount are required." });
    }
    const expense = await Expense.create({
      title,
      category,
      amount: Number(amount),
      paymentMethod: paymentMethod || "Cash",
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      reference,
      notes,
      recordedBy: req.user?._id,
    });
    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    next(error);
  }
};

// @desc    Update an expense
// @route   PUT /api/expenses/:id
// @access  Private
export const updateExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!expense) return res.status(404).json({ success: false, message: "Expense not found" });
    res.status(200).json({ success: true, data: expense });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
// @access  Private
export const deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ success: false, message: "Expense not found" });
    res.status(200).json({ success: true, message: "Expense deleted." });
  } catch (error) {
    next(error);
  }
};

// @desc    Get expense summary metrics
// @route   GET /api/expenses/metrics
// @access  Private
export const getExpenseMetrics = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [allExpenses, monthlyExpenses, todayExpenses] = await Promise.all([
      Expense.find(),
      Expense.find({ expenseDate: { $gte: startOfMonth } }),
      Expense.find({ expenseDate: { $gte: startOfDay } }),
    ]);

    const totalAll = allExpenses.reduce((s, e) => s + e.amount, 0);
    const totalMonthly = monthlyExpenses.reduce((s, e) => s + e.amount, 0);
    const totalToday = todayExpenses.reduce((s, e) => s + e.amount, 0);

    const byCategory = {};
    allExpenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });

    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

    res.status(200).json({
      success: true,
      data: {
        totalAll: Math.round(totalAll * 100) / 100,
        totalMonthly: Math.round(totalMonthly * 100) / 100,
        totalToday: Math.round(totalToday * 100) / 100,
        totalCount: allExpenses.length,
        topCategory: topCategory ? topCategory[0] : "N/A",
        byCategory,
      },
    });
  } catch (error) {
    next(error);
  }
};
