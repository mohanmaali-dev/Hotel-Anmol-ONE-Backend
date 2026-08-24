import { randomInt } from 'node:crypto';

import mongoose from 'mongoose';

import { Expense } from '../models/expense.model.js';
import { sendSuccess } from '../utils/api-response.js';

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const generateExpenseNo = () => {
  const now = new Date();
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((value) => String(value).padStart(2, '0'))
    .join('');
  return `EXP-${date}-${Date.now().toString().slice(-6)}${randomInt(10, 100)}`;
};

const getPagination = (query) => {
  const page = Math.max(Math.floor(Number(query.page)) || 1, 1);
  const limit = Math.min(Math.max(Math.floor(Number(query.limit)) || 20, 1), 100);
  return { page, limit };
};

const buildDateFilter = (fromDate, toDate) => {
  const date = {};
  if (fromDate) date.$gte = new Date(`${fromDate}T00:00:00.000Z`);
  if (toDate) date.$lte = new Date(`${toDate}T23:59:59.999Z`);
  return Object.keys(date).length ? date : undefined;
};

const getPositiveAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw createError('Amount must be greater than 0', 400);
  }
  return amount;
};

const findExpense = async (id) => {
  const query = mongoose.isValidObjectId(id) ? { _id: id } : { expenseNo: id.trim().toUpperCase() };
  const expense = await Expense.findOne(query);
  if (!expense) throw createError('Expense not found', 404);
  return expense;
};

export const getExpenses = async (request, response) => {
  const { page, limit } = getPagination(request.query);
  const filters = {};
  const search = request.query.search?.trim();
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filters.$or = [{ expenseNo: pattern }, { description: pattern }, { reference: pattern }];
  }
  if (request.query.category) filters.category = request.query.category;
  if (request.query.paymentType) filters.paymentType = request.query.paymentType;
  const dateFilter = buildDateFilter(request.query.fromDate, request.query.toDate);
  if (dateFilter) filters.date = dateFilter;

  const [expenses, total] = await Promise.all([
    Expense.find(filters)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Expense.countDocuments(filters),
  ]);
  return sendSuccess(response, {
    message: 'Expenses fetched successfully',
    data: expenses,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

export const getExpense = async (request, response) => {
  const expense = await findExpense(request.params.id);
  return sendSuccess(response, { message: 'Expense fetched successfully', data: expense });
};

export const createExpense = async (request, response) => {
  const expense = await Expense.create({
    expenseNo: generateExpenseNo(),
    date: request.body.date || new Date(),
    category: request.body.category,
    amount: getPositiveAmount(request.body.amount),
    paymentType: request.body.paymentType,
    description: request.body.description,
    reference: request.body.reference,
    notes: request.body.notes,
    addedBy: request.userId,
  });
  return sendSuccess(response, {
    statusCode: 201,
    message: 'Expense created successfully',
    data: expense,
  });
};

export const updateExpense = async (request, response) => {
  const expense = await findExpense(request.params.id);
  ['date', 'category', 'paymentType', 'description', 'reference', 'notes'].forEach((field) => {
    if (request.body[field] !== undefined) expense[field] = request.body[field] || null;
  });
  if (request.body.amount !== undefined) expense.amount = getPositiveAmount(request.body.amount);
  await expense.save();
  return sendSuccess(response, { message: 'Expense updated successfully', data: expense });
};

export const deleteExpense = async (request, response) => {
  const expense = await findExpense(request.params.id);
  await expense.deleteOne();
  return sendSuccess(response, { message: 'Expense deleted successfully', data: expense });
};

export const getExpenseSummary = async (_request, response) => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [summary] = await Expense.aggregate([
    {
      $facet: {
        today: [
          { $match: { date: { $gte: startOfToday, $lte: endOfToday } } },
          { $group: { _id: null, amount: { $sum: '$amount' } } },
        ],
        month: [
          { $match: { date: { $gte: startOfMonth, $lt: startOfNextMonth } } },
          { $group: { _id: null, amount: { $sum: '$amount' } } },
        ],
        total: [{ $group: { _id: null, amount: { $sum: '$amount' } } }],
        byCategory: [
          { $group: { _id: '$category', amount: { $sum: '$amount' } } },
          { $project: { _id: 0, category: '$_id', amount: 1 } },
          { $sort: { amount: -1, category: 1 } },
        ],
      },
    },
    {
      $project: {
        todayExpenses: { $ifNull: [{ $arrayElemAt: ['$today.amount', 0] }, 0] },
        monthExpenses: { $ifNull: [{ $arrayElemAt: ['$month.amount', 0] }, 0] },
        totalExpenses: { $ifNull: [{ $arrayElemAt: ['$total.amount', 0] }, 0] },
        byCategory: 1,
      },
    },
  ]);

  return sendSuccess(response, {
    message: 'Expense summary fetched successfully',
    data: summary || {
      todayExpenses: 0,
      monthExpenses: 0,
      totalExpenses: 0,
      byCategory: [],
    },
  });
};
