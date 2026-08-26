import mongoose from 'mongoose';

import { Bill } from '../models/bill.model.js';
import { Order } from '../models/order.model.js';
import { Sale } from '../models/sale.model.js';
import { sendSuccess } from '../utils/api-response.js';
import { buildDateFilter, getCurrentDayRange } from '../utils/date-range.js';

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getPagination = (query) => {
  const page = Math.max(Math.floor(Number(query.page)) || 1, 1);
  const limit = Math.min(Math.max(Math.floor(Number(query.limit)) || 20, 1), 100);
  return { page, limit };
};

export const getSales = async (request, response) => {
  const { page, limit } = getPagination(request.query);
  const filters = {};
  const search = request.query.search?.trim();

  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filters.$or = [
      { saleNo: pattern },
      { billNo: pattern },
      { orderNo: pattern },
      { customerName: pattern },
    ];
  }
  if (request.query.orderType) filters.orderType = request.query.orderType;
  if (request.query.paymentType) filters.paymentType = request.query.paymentType;
  if (request.query.paymentStatus) filters.paymentStatus = request.query.paymentStatus;

  const dateFilter = buildDateFilter(request.query.fromDate, request.query.toDate);
  if (dateFilter) filters.date = dateFilter;

  const [sales, total] = await Promise.all([
    Sale.find(filters)
      .populate('biller', 'name username')
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Sale.countDocuments(filters),
  ]);

  return sendSuccess(response, {
    message: 'Sales fetched successfully',
    data: sales,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

export const getSale = async (request, response) => {
  const query = mongoose.isValidObjectId(request.params.id)
    ? { _id: request.params.id }
    : { saleNo: request.params.id.trim().toUpperCase() };
  const sale = await Sale.findOne(query).populate('biller', 'name username');
  if (!sale) throw createError('Sale not found', 404);
  const [bill, order] = await Promise.all([
    Bill.findById(sale.billId).select('items subtotal discount additionalCharges').lean(),
    Order.findById(sale.orderId).select('items areaType areaRoomNo').lean(),
  ]);
  return sendSuccess(response, {
    message: 'Sale fetched successfully',
    data: {
      ...sale.toObject(),
      items: bill?.items || order?.items || [],
      areaType: order?.areaType,
      areaRoomNo: order?.areaRoomNo,
      subtotal: bill?.subtotal,
      discount: bill?.discount,
      additionalCharges: bill?.additionalCharges,
    },
  });
};

export const getSalesSummary = async (_request, response) => {
  const today = getCurrentDayRange();

  const [summary] = await Sale.aggregate([
    { $match: { date: { $gte: today.start, $lt: today.end } } },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$finalAmount' },
        paidAmount: { $sum: '$paidAmount' },
        dueAmount: { $sum: '$dueAmount' },
        cashSales: {
          $sum: { $cond: [{ $eq: ['$paymentType', 'Cash'] }, '$paidAmount', 0] },
        },
        upiSales: {
          $sum: { $cond: [{ $eq: ['$paymentType', 'UPI'] }, '$paidAmount', 0] },
        },
        cardSales: {
          $sum: { $cond: [{ $eq: ['$paymentType', 'Card'] }, '$paidAmount', 0] },
        },
        totalOrders: { $sum: 1 },
      },
    },
    { $project: { _id: 0 } },
  ]);

  return sendSuccess(response, {
    message: 'Sales summary fetched successfully',
    data: summary || {
      totalSales: 0,
      paidAmount: 0,
      dueAmount: 0,
      cashSales: 0,
      upiSales: 0,
      cardSales: 0,
      totalOrders: 0,
    },
  });
};
