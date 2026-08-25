import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { Expense } from '../models/expense.model.js';
import { Order } from '../models/order.model.js';
import { Purchase } from '../models/purchase.model.js';
import { Sale } from '../models/sale.model.js';
import { StockHistory } from '../models/stock-history.model.js';
import { StockItem } from '../models/stock-item.model.js';
import { sendSuccess } from '../utils/api-response.js';
import { addDateFilter, getReportContext } from '../utils/report-filters.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sendReport = (response, message, filters, summary, data) =>
  sendSuccess(response, { message, filters, summary, data });

const buildSaleMatch = (filters, dateRange) => {
  const match = {};
  if (filters.paymentType) match.paymentType = filters.paymentType;
  if (filters.orderType) match.orderType = filters.orderType;
  if (filters.paymentStatus || filters.status) {
    match.paymentStatus = filters.paymentStatus || filters.status;
  }
  return addDateFilter(match, 'date', dateRange);
};

const buildPurchaseMatch = (filters, dateRange) => {
  const match = {};
  if (filters.paymentType) match.paymentType = filters.paymentType;
  if (filters.paymentStatus) match.paymentStatus = filters.paymentStatus;
  if (filters.status) match.purchaseStatus = filters.status;
  else match.purchaseStatus = { $ne: 'Cancelled' };
  if (filters.supplier) {
    if (mongoose.isValidObjectId(filters.supplier)) {
      match.supplierId = new mongoose.Types.ObjectId(filters.supplier);
    } else {
      match.supplierName = new RegExp(escapeRegex(filters.supplier), 'i');
    }
  }
  return addDateFilter(match, 'purchaseDate', dateRange);
};

export const getSalesReport = async (request, response) => {
  const { filters, dateRange } = getReportContext(request.query);
  const match = buildSaleMatch(filters, dateRange);
  const [result] = await Sale.aggregate([
    { $match: match },
    {
      $facet: {
        summary: [
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
        ],
        daily: [
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$date',
                  timezone: env.appTimezone,
                },
              },
              totalSales: { $sum: '$finalAmount' },
              paidAmount: { $sum: '$paidAmount' },
              dueAmount: { $sum: '$dueAmount' },
              totalOrders: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              date: '$_id',
              totalSales: 1,
              paidAmount: 1,
              dueAmount: 1,
              totalOrders: 1,
            },
          },
          { $sort: { date: -1 } },
        ],
      },
    },
  ]);
  const summary = result?.summary[0] || {
    totalSales: 0,
    paidAmount: 0,
    dueAmount: 0,
    cashSales: 0,
    upiSales: 0,
    cardSales: 0,
    totalOrders: 0,
  };
  return sendReport(
    response,
    'Sales report fetched successfully',
    filters,
    summary,
    result?.daily || [],
  );
};

export const getPurchaseReport = async (request, response) => {
  const { filters, dateRange } = getReportContext(request.query);
  const match = buildPurchaseMatch(filters, dateRange);
  const [totals, supplierWise, rows] = await Promise.all([
    Purchase.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalPurchaseAmount: { $sum: '$finalAmount' },
          paidAmount: { $sum: '$paidAmount' },
          dueAmount: { $sum: '$dueAmount' },
          totalPurchases: { $sum: 1 },
        },
      },
      { $project: { _id: 0 } },
    ]),
    Purchase.aggregate([
      { $match: match },
      { $sort: { purchaseDate: 1, createdAt: 1 } },
      {
        $group: {
          _id: '$supplierId',
          supplierName: { $last: '$supplierName' },
          totalPurchaseAmount: { $sum: '$finalAmount' },
          paidAmount: { $sum: '$paidAmount' },
          dueAmount: { $sum: '$dueAmount' },
          totalPurchases: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          supplierId: '$_id',
          supplierName: 1,
          totalPurchaseAmount: 1,
          paidAmount: 1,
          dueAmount: 1,
          totalPurchases: 1,
        },
      },
      { $sort: { totalPurchaseAmount: -1, supplierName: 1 } },
    ]),
    Purchase.find(match)
      .select(
        'purchaseNo supplierId supplierName purchaseDate supplierInvoiceNo finalAmount paidAmount dueAmount paymentType paymentStatus purchaseStatus',
      )
      .sort({ purchaseDate: -1, createdAt: -1 })
      .lean(),
  ]);
  const summary = {
    ...(totals[0] || {
      totalPurchaseAmount: 0,
      paidAmount: 0,
      dueAmount: 0,
      totalPurchases: 0,
    }),
    supplierWise,
  };
  return sendReport(response, 'Purchase report fetched successfully', filters, summary, rows);
};

export const getExpenseReport = async (request, response) => {
  const { filters, dateRange } = getReportContext(request.query);
  const match = {};
  if (filters.category) match.category = filters.category;
  if (filters.paymentType) match.paymentType = filters.paymentType;
  addDateFilter(match, 'date', dateRange);
  const [totals, byCategory, rows] = await Promise.all([
    Expense.aggregate([
      { $match: match },
      { $group: { _id: null, totalExpenses: { $sum: '$amount' } } },
      { $project: { _id: 0 } },
    ]),
    Expense.aggregate([
      { $match: match },
      { $group: { _id: '$category', amount: { $sum: '$amount' } } },
      { $project: { _id: 0, category: '$_id', amount: 1 } },
      { $sort: { amount: -1, category: 1 } },
    ]),
    Expense.find(match).sort({ date: -1, createdAt: -1 }).lean(),
  ]);
  const summary = { totalExpenses: totals[0]?.totalExpenses || 0, byCategory };
  return sendReport(response, 'Expense report fetched successfully', filters, summary, rows);
};

export const getStockReport = async (request, response) => {
  const { filters, dateRange } = getReportContext(request.query);
  const itemMatch = {};
  if (filters.category) itemMatch.category = filters.category;
  if (filters.status) itemMatch.status = filters.status;
  if (filters.supplier && mongoose.isValidObjectId(filters.supplier)) {
    itemMatch.supplierId = filters.supplier;
  }
  const stockItems = await StockItem.find(itemMatch).sort({ itemName: 1 });
  const hasItemFilters = Object.keys(itemMatch).length > 0;
  const movementMatch = {};
  if (hasItemFilters) movementMatch.stockItemId = { $in: stockItems.map((item) => item._id) };
  addDateFilter(movementMatch, 'date', dateRange);
  const movementTotals = await StockHistory.aggregate([
    { $match: movementMatch },
    { $group: { _id: '$type', quantity: { $sum: '$quantity' } } },
  ]);
  const movementByType = Object.fromEntries(
    movementTotals.map((movement) => [movement._id, movement.quantity]),
  );
  const summary = stockItems.reduce(
    (result, item) => {
      result.totalStockItems += 1;
      result.totalStockValue += item.currentQuantity * item.purchasePrice;
      if (item.status === 'Low Stock') result.lowStockItems += 1;
      if (item.status === 'Out of Stock') result.outOfStockItems += 1;
      return result;
    },
    {
      totalStockItems: 0,
      totalStockValue: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
      totalStockIn: movementByType.IN || 0,
      totalStockOut: movementByType.OUT || 0,
    },
  );
  const rows = stockItems.map((item) => item.toObject({ virtuals: true }));
  return sendReport(response, 'Stock report fetched successfully', filters, summary, rows);
};

export const getPaymentReport = async (request, response) => {
  const { filters, dateRange } = getReportContext(request.query);
  const match = buildSaleMatch(filters, dateRange);
  const [summary] = await Sale.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        cashAmount: { $sum: { $cond: [{ $eq: ['$paymentType', 'Cash'] }, '$paidAmount', 0] } },
        upiAmount: { $sum: { $cond: [{ $eq: ['$paymentType', 'UPI'] }, '$paidAmount', 0] } },
        cardAmount: { $sum: { $cond: [{ $eq: ['$paymentType', 'Card'] }, '$paidAmount', 0] } },
        paidAmount: { $sum: '$paidAmount' },
        partialAmount: {
          $sum: { $cond: [{ $eq: ['$paymentStatus', 'Partial'] }, '$paidAmount', 0] },
        },
        dueNotPaidAmount: { $sum: '$dueAmount' },
      },
    },
    { $project: { _id: 0 } },
  ]);
  return sendReport(
    response,
    'Payment report fetched successfully',
    filters,
    summary || {
      cashAmount: 0,
      upiAmount: 0,
      cardAmount: 0,
      paidAmount: 0,
      partialAmount: 0,
      dueNotPaidAmount: 0,
    },
    [],
  );
};

export const getOrderReport = async (request, response) => {
  const { filters, dateRange } = getReportContext(request.query);
  const match = {};
  if (filters.orderType) match.orderType = filters.orderType;
  if (filters.paymentType) match.paymentType = filters.paymentType;
  if (filters.paymentStatus) match.paymentStatus = filters.paymentStatus;
  if (filters.status) match.orderStatus = filters.status;
  addDateFilter(match, 'date', dateRange);
  const [totals, rows] = await Promise.all([
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          dineInOrders: { $sum: { $cond: [{ $eq: ['$orderType', 'Dine In'] }, 1, 0] } },
          parcelOrders: { $sum: { $cond: [{ $eq: ['$orderType', 'Parcel'] }, 1, 0] } },
          roomOrders: { $sum: { $cond: [{ $eq: ['$orderType', 'Room'] }, 1, 0] } },
          pendingOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Pending'] }, 1, 0] } },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'Completed'] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'Cancelled'] }, 1, 0] },
          },
        },
      },
      { $project: { _id: 0 } },
    ]),
    Order.find(match)
      .select(
        'orderNo date orderType areaType areaRoomNo customerName finalAmount paymentType paymentStatus orderStatus biller',
      )
      .sort({ date: -1, createdAt: -1 })
      .lean(),
  ]);
  return sendReport(
    response,
    'Order report fetched successfully',
    filters,
    totals[0] || {
      totalOrders: 0,
      dineInOrders: 0,
      parcelOrders: 0,
      roomOrders: 0,
      pendingOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
    },
    rows,
  );
};
