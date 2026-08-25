import { randomInt } from 'node:crypto';

import mongoose from 'mongoose';

import { Bill } from '../models/bill.model.js';
import { Order } from '../models/order.model.js';
import { Setting } from '../models/setting.model.js';
import { sendSuccess } from '../utils/api-response.js';
import { buildDateFilter } from '../utils/date-range.js';
import { calculatePayment } from '../utils/payment-calculations.js';
import { getPaymentHistory, recordPaymentChange } from '../utils/payment-history.js';
import { syncSaleFromBill } from '../utils/sale-sync.js';
import { runInTransaction } from '../utils/transaction.js';

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const generateBillNo = async () => {
  const now = new Date();
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((value) => String(value).padStart(2, '0'))
    .join('');
  const settings = await Setting.findOne({ key: 'restaurant-settings' }).select(
    'billing.billPrefix',
  );
  const prefix =
    String(settings?.billing?.billPrefix || 'BILL')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '') || 'BILL';
  return `${prefix}-${date}-${Date.now().toString().slice(-6)}${randomInt(10, 100)}`;
};

const getPagination = (query) => {
  const page = Math.max(Math.floor(Number(query.page)) || 1, 1);
  const limit = Math.min(Math.max(Math.floor(Number(query.limit)) || 20, 1), 100);
  return { page, limit };
};

const findOrder = async (id) => {
  const query = mongoose.isValidObjectId(id) ? { _id: id } : { orderNo: id.trim().toUpperCase() };
  const order = await Order.findOne(query);
  if (!order) throw createError('Order not found', 404);
  return order;
};

const findBill = async (id) => {
  const query = mongoose.isValidObjectId(id) ? { _id: id } : { billNo: id.trim().toUpperCase() };
  const bill = await Bill.findOne(query);
  if (!bill) throw createError('Bill not found', 404);
  return bill;
};

const executeBillPaymentUpdate = async (id, body, userId, session) => {
  const query = mongoose.isValidObjectId(id) ? { _id: id } : { billNo: id.trim().toUpperCase() };
  const bill = await Bill.findOne(query).session(session || null);
  if (!bill) throw createError('Bill not found', 404);
  const order = await Order.findById(bill.orderId).session(session || null);
  if (!order) throw createError('Related order not found', 404);

  const paymentType = body.paymentType || bill.paymentType;
  const payment = calculatePayment(bill.finalAmount, body.paidAmount, paymentType);
  if (payment.paidAmount < bill.paidAmount && !String(body.reason || '').trim()) {
    throw createError('Please enter a reason for reducing the paid amount', 400);
  }
  const previousPayment = {
    paidAmount: bill.paidAmount,
    dueAmount: bill.dueAmount,
    paymentType: bill.paymentType,
    paymentStatus: bill.paymentStatus,
  };

  bill.set(payment);
  order.paymentStatus = payment.paymentStatus;
  order.paymentType = payment.paymentType;
  order.paymentRecorded = order.paymentRecorded || payment.paidAmount > 0;
  await bill.save({ session });
  await order.save({ session });
  await syncSaleFromBill(bill, { session });
  await recordPaymentChange({
    recordType: 'Bill',
    recordId: bill._id,
    previous: previousPayment,
    current: payment,
    changedBy: userId,
    reason: body.reason,
    session,
  });
  return bill;
};

const syncBillRelations = (bill, order) => {
  const updateRelations = async (session) => {
    await syncSaleFromBill(bill, { session });
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          paymentStatus: bill.paymentStatus,
          paymentType: bill.paymentType,
          ...(bill.paidAmount > 0 ? { paymentRecorded: true } : {}),
        },
      },
      { session, runValidators: true },
    );
  };
  return runInTransaction(updateRelations, () => updateRelations());
};

export const getBills = async (request, response) => {
  const { page, limit } = getPagination(request.query);
  const filters = {};
  const search = request.query.search?.trim();

  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filters.$or = [{ billNo: pattern }, { orderNo: pattern }, { customerName: pattern }];
  }
  if (request.query.paymentStatus) filters.paymentStatus = request.query.paymentStatus;
  if (request.query.paymentType) filters.paymentType = request.query.paymentType;

  const dateFilter = buildDateFilter(request.query.fromDate, request.query.toDate);
  if (dateFilter) filters.date = dateFilter;

  const [bills, total] = await Promise.all([
    Bill.find(filters)
      .populate('biller', 'name username')
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Bill.countDocuments(filters),
  ]);

  return sendSuccess(response, {
    message: 'Bills fetched successfully',
    data: bills,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

export const getBill = async (request, response) => {
  const bill = await findBill(request.params.id);
  await bill.populate('biller', 'name username');
  const paymentHistory = await getPaymentHistory('Bill', bill._id);
  return sendSuccess(response, {
    message: 'Bill fetched successfully',
    data: { ...bill.toObject(), paymentHistory },
  });
};

export const createBillFromOrder = async (request, response) => {
  const order = await findOrder(request.params.orderId);
  if (order.orderStatus === 'Cancelled') {
    throw createError('A bill cannot be generated for a cancelled order', 400);
  }
  const existingBill = await Bill.findOne({ orderId: order._id });
  if (existingBill) {
    await syncBillRelations(existingBill, order);
    return sendSuccess(response, {
      message: 'Bill already generated. Opening the existing bill.',
      data: existingBill,
    });
  }

  if (request.body.paidAmount === undefined && order.paymentStatus === 'Partial') {
    throw createError('Paid amount is required for a partially paid order', 400);
  }

  const paidAmount =
    request.body.paidAmount ?? (order.paymentStatus === 'Paid' ? order.finalAmount : 0);
  const paymentType = request.body.paymentType || order.paymentType;
  const payment = calculatePayment(order.finalAmount, paidAmount, paymentType);
  let bill;
  try {
    bill = await Bill.create({
      billNo: await generateBillNo(),
      orderId: order._id,
      orderNo: order.orderNo,
      date: new Date(),
      customerName: order.customerName,
      orderType: order.orderType,
      items: order.items.map((item) => ({
        menuItemId: item.menuItemId,
        itemName: item.itemName,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
        servingSize: item.servingSize,
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      additionalCharges: order.additionalCharges,
      finalAmount: order.finalAmount,
      biller: order.biller,
      ...payment,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const duplicateBill = await Bill.findOne({ orderId: order._id });
    if (!duplicateBill) throw error;
    await syncBillRelations(duplicateBill, order);
    return sendSuccess(response, {
      message: 'Bill already generated. Opening the existing bill.',
      data: duplicateBill,
    });
  }

  await syncBillRelations(bill, order);

  return sendSuccess(response, {
    statusCode: 201,
    message: 'Bill generated successfully',
    data: bill,
  });
};

export const updateBillPayment = async (request, response) => {
  if (request.body.paidAmount === undefined) {
    throw createError('Paid amount is required', 400);
  }

  const update = (session) =>
    executeBillPaymentUpdate(request.params.id, request.body, request.userId, session);
  const bill = await runInTransaction(update, () => update());

  return sendSuccess(response, {
    message: 'Bill payment updated successfully',
    data: bill,
  });
};
