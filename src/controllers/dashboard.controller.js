import { Order } from '../models/order.model.js';
import { Purchase } from '../models/purchase.model.js';
import { Sale } from '../models/sale.model.js';
import { StockItem } from '../models/stock-item.model.js';
import { env } from '../config/env.js';
import { sendSuccess } from '../utils/api-response.js';
import { getCurrentDayRange } from '../utils/date-range.js';
import { hasPermission } from '../utils/permissions.js';

const emptySales = { totalSales: 0, paidAmount: 0, dueAmount: 0 };
const emptyPurchases = { totalPurchaseAmount: 0, totalPurchases: 0 };
const emptyStock = {
  totalStockItems: 0,
  totalStockValue: 0,
  lowStockItems: 0,
  outOfStockItems: 0,
};

const getTodayText = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: env.appTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

export const getDashboard = async (request, response) => {
  const access = {
    sales: hasPermission(request.user, 'sales', 'view'),
    orders: hasPermission(request.user, 'orders', 'view'),
    purchases: hasPermission(request.user, 'purchases', 'view'),
    stock: hasPermission(request.user, 'stock', 'view'),
  };
  const today = getCurrentDayRange();

  const [salesRows, todayOrders, recentOrders, purchaseRows, stockRows, stockAttention] =
    await Promise.all([
      access.sales
        ? Sale.aggregate([
            { $match: { date: { $gte: today.start, $lt: today.end } } },
            {
              $group: {
                _id: null,
                totalSales: { $sum: '$finalAmount' },
                paidAmount: { $sum: '$paidAmount' },
                dueAmount: { $sum: '$dueAmount' },
              },
            },
            { $project: { _id: 0 } },
          ])
        : [],
      access.orders ? Order.countDocuments({ date: { $gte: today.start, $lt: today.end } }) : 0,
      access.orders
        ? Order.find()
            .populate('biller', 'name username')
            .sort({ date: -1, createdAt: -1 })
            .limit(5)
            .lean()
        : [],
      access.purchases
        ? Purchase.aggregate([
            { $match: { purchaseStatus: { $ne: 'Cancelled' } } },
            {
              $group: {
                _id: null,
                totalPurchaseAmount: { $sum: '$finalAmount' },
                totalPurchases: { $sum: 1 },
              },
            },
            { $project: { _id: 0 } },
          ])
        : [],
      access.stock
        ? StockItem.aggregate([
            { $match: { isActive: { $ne: false } } },
            {
              $group: {
                _id: null,
                totalStockItems: { $sum: 1 },
                totalStockValue: {
                  $sum: { $multiply: ['$currentQuantity', '$purchasePrice'] },
                },
                lowStockItems: {
                  $sum: { $cond: [{ $eq: ['$status', 'Low Stock'] }, 1, 0] },
                },
                outOfStockItems: {
                  $sum: { $cond: [{ $eq: ['$status', 'Out of Stock'] }, 1, 0] },
                },
              },
            },
            { $project: { _id: 0 } },
          ])
        : [],
      access.stock
        ? StockItem.find({
            isActive: { $ne: false },
            status: { $in: ['Low Stock', 'Out of Stock'] },
          })
            .sort({ currentQuantity: 1, itemName: 1 })
            .limit(5)
            .lean()
        : [],
    ]);

  return sendSuccess(response, {
    message: 'Dashboard fetched successfully',
    data: {
      today: getTodayText(),
      timezone: env.appTimezone,
      refreshedAt: new Date(),
      access,
      sales: access.sales ? salesRows[0] || emptySales : null,
      orders: access.orders ? { todayOrders, recentOrders } : null,
      purchases: access.purchases ? purchaseRows[0] || emptyPurchases : null,
      stock: access.stock
        ? { ...(stockRows[0] || emptyStock), attentionItems: stockAttention }
        : null,
    },
  });
};
