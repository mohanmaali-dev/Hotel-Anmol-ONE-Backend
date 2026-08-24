import { randomInt } from 'node:crypto';

import mongoose from 'mongoose';

import { Bill } from '../models/bill.model.js';
import { MenuItem } from '../models/menu-item.model.js';
import { Order } from '../models/order.model.js';
import { sendSuccess } from '../utils/api-response.js';
import { calculateOrderTotals } from '../utils/order-calculations.js';
import { completeOrderWithStock } from '../utils/order-stock.js';

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const generateOrderNo = () => {
  const now = new Date();
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((value) => String(value).padStart(2, '0'))
    .join('');
  return `ORD-${date}-${Date.now().toString().slice(-6)}${randomInt(10, 100)}`;
};

const findOrder = async (id) => {
  const query = mongoose.isValidObjectId(id) ? { _id: id } : { orderNo: id.trim().toUpperCase() };
  const order = await Order.findOne(query);

  if (!order) throw createError('Order not found', 404);
  return order;
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

const getServerPricedItems = async (items) => {
  if (!Array.isArray(items) || items.length === 0) return items;
  const ids = items.map((item, index) => {
    if (!mongoose.isValidObjectId(item.menuItemId)) {
      throw createError(`Item ${index + 1}: invalid menu item ID`, 400);
    }
    return item.menuItemId;
  });
  const menuItems = await MenuItem.find({ _id: { $in: ids } })
    .populate('categoryId', 'status')
    .lean();
  const menuById = new Map(menuItems.map((item) => [String(item._id), item]));
  return items.map((item, index) => {
    const menuItem = menuById.get(String(item.menuItemId));
    if (!menuItem) throw createError(`Item ${index + 1}: menu item not found`, 404);
    if (menuItem.availability !== 'Available' || menuItem.categoryId?.status === 'Inactive') {
      throw createError(`${menuItem.itemName} is currently unavailable`, 400);
    }
    return {
      menuItemId: menuItem._id,
      itemName: menuItem.itemName,
      quantity: item.quantity,
      rate: menuItem.sellingPrice,
    };
  });
};

export const getOrders = async (request, response) => {
  const { page, limit } = getPagination(request.query);
  const filters = {};
  const search = request.query.search?.trim();

  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filters.$or = [{ orderNo: pattern }, { customerName: pattern }];
  }
  if (request.query.orderType) filters.orderType = request.query.orderType;
  if (request.query.paymentStatus) filters.paymentStatus = request.query.paymentStatus;
  if (request.query.status) filters.orderStatus = request.query.status;

  const dateFilter = buildDateFilter(request.query.fromDate, request.query.toDate);
  if (dateFilter) filters.date = dateFilter;

  const [orders, total] = await Promise.all([
    Order.find(filters)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filters),
  ]);

  return sendSuccess(response, {
    message: 'Orders fetched successfully',
    data: orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
};

export const getOrder = async (request, response) => {
  const order = await findOrder(request.params.id);
  return sendSuccess(response, { message: 'Order fetched successfully', data: order });
};

export const createOrder = async (request, response) => {
  const orderStatus = request.body.orderStatus || 'Pending';
  if (orderStatus === 'Completed') {
    throw createError('Create the order first, then mark it as Completed to deduct stock', 400);
  }
  const pricedItems = await getServerPricedItems(request.body.items);
  const totals = calculateOrderTotals(
    pricedItems,
    request.body.discount,
    request.body.additionalCharges,
  );
  const order = await Order.create({
    orderNo: generateOrderNo(),
    date: request.body.date || new Date(),
    orderType: request.body.orderType,
    areaType: request.body.areaType,
    areaRoomNo: request.body.areaRoomNo,
    customerName: request.body.customerName,
    biller: request.userId,
    paymentType: request.body.paymentType,
    paymentStatus: request.body.paymentStatus,
    orderStatus,
    cancelledAt: orderStatus === 'Cancelled' ? new Date() : null,
    stockDeducted: false,
    stockProcessing: false,
    stockDeductedAt: null,
    ...totals,
  });

  return sendSuccess(response, {
    statusCode: 201,
    message: 'Order created successfully',
    data: order,
  });
};

export const updateOrder = async (request, response) => {
  const order = await findOrder(request.params.id);
  const nextStatus = request.body.orderStatus ?? order.orderStatus;
  const hasNonStatusChanges = Object.keys(request.body).some(
    (field) => !['orderStatus', 'user'].includes(field),
  );

  if (order.stockProcessing) {
    throw createError('Order stock deduction is already in progress', 409);
  }
  if (order.stockDeducted && order.orderStatus !== 'Completed') {
    throw createError('Order stock has already been deducted and requires manual review', 409);
  }
  if (order.orderStatus === 'Completed') {
    if (nextStatus !== 'Completed') {
      throw createError(
        'Completed orders cannot be cancelled or reopened without a stock reversal',
        400,
      );
    }
    if (hasNonStatusChanges) {
      throw createError('Completed orders cannot be edited after stock deduction', 400);
    }
    const completedOrder = order.stockDeducted
      ? order
      : await completeOrderWithStock(order, request.userId);
    return sendSuccess(response, {
      message: order.stockDeducted
        ? 'Order is already completed; stock was not deducted again'
        : 'Order completed and stock deducted successfully',
      data: completedOrder,
    });
  }
  if (order.orderStatus === 'Cancelled') {
    if (nextStatus !== 'Cancelled' || hasNonStatusChanges) {
      throw createError('Cancelled orders cannot be edited or completed', 400);
    }
    return sendSuccess(response, { message: 'Order status is unchanged', data: order });
  }

  const pricedItems = request.body.items
    ? await getServerPricedItems(request.body.items)
    : order.items;
  const totals = calculateOrderTotals(
    pricedItems,
    request.body.discount ?? order.discount,
    request.body.additionalCharges ?? order.additionalCharges,
  );
  const editableFields = [
    'date',
    'orderType',
    'areaType',
    'areaRoomNo',
    'customerName',
    'paymentType',
    'paymentStatus',
  ];
  const updates = { ...totals };
  editableFields.forEach((field) => {
    if (request.body[field] !== undefined) updates[field] = request.body[field];
  });
  updates.orderStatus = nextStatus === 'Completed' ? order.orderStatus : nextStatus;
  if (nextStatus === 'Cancelled') updates.cancelledAt = new Date();

  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      updatedAt: order.updatedAt,
      orderStatus: order.orderStatus,
      stockDeducted: { $ne: true },
      stockProcessing: { $ne: true },
    },
    { $set: updates },
    { returnDocument: 'after', runValidators: true },
  );
  if (!updatedOrder) {
    throw createError('Order changed while it was being updated. Please try again', 409);
  }

  if (nextStatus === 'Completed') {
    const completedOrder = await completeOrderWithStock(updatedOrder, request.userId);
    return sendSuccess(response, {
      message: 'Order completed and stock deducted successfully',
      data: completedOrder,
    });
  }

  return sendSuccess(response, { message: 'Order updated successfully', data: updatedOrder });
};

export const deleteOrder = async (request, response) => {
  const order = await findOrder(request.params.id);
  if (order.orderStatus === 'Completed' || order.stockDeducted) {
    throw createError('Completed orders cannot be deleted without a stock reversal', 400);
  }
  if (await Bill.exists({ orderId: order._id })) {
    throw createError('Orders with a generated bill cannot be deleted', 400);
  }
  const result = await Order.deleteOne({
    _id: order._id,
    stockDeducted: { $ne: true },
    stockProcessing: { $ne: true },
  });
  if (result.deletedCount === 0) {
    throw createError('Order completion is in progress and the order cannot be deleted', 409);
  }
  return sendSuccess(response, { message: 'Order deleted successfully', data: order });
};
