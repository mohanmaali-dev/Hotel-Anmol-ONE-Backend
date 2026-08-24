import { randomInt } from 'node:crypto';

import mongoose from 'mongoose';

import { Purchase } from '../models/purchase.model.js';
import { StockItem } from '../models/stock-item.model.js';
import { Supplier } from '../models/supplier.model.js';
import { sendSuccess } from '../utils/api-response.js';
import { calculatePayment } from '../utils/payment-calculations.js';
import { calculatePurchaseTotals } from '../utils/purchase-calculations.js';
import { applyStockMovement, rollbackAppliedMovement } from '../utils/stock-movement.js';

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const generatePurchaseNo = () => {
  const now = new Date();
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((value) => String(value).padStart(2, '0'))
    .join('');
  return `PUR-${date}-${Date.now().toString().slice(-6)}${randomInt(10, 100)}`;
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

const findPurchase = async (id) => {
  const query = mongoose.isValidObjectId(id)
    ? { _id: id }
    : { purchaseNo: id.trim().toUpperCase() };
  const purchase = await Purchase.findOne(query);
  if (!purchase) throw createError('Purchase not found', 404);
  return purchase;
};

const findSupplier = async (supplierId) => {
  if (!supplierId) throw createError('Supplier is required', 400);
  if (!mongoose.isValidObjectId(supplierId)) throw createError('Invalid supplier ID', 400);
  const supplier = await Supplier.findById(supplierId);
  if (!supplier) throw createError('Supplier not found', 404);
  return supplier;
};

const getValidatedPurchaseItems = async (items) => {
  if (!Array.isArray(items) || items.length === 0) return items;
  const ids = items.map((item, index) => {
    if (!mongoose.isValidObjectId(item.stockItemId)) {
      throw createError(`Item ${index + 1}: invalid stock item ID`, 400);
    }
    return item.stockItemId;
  });
  const stockItems = await StockItem.find({ _id: { $in: ids } }).lean();
  const stockById = new Map(stockItems.map((item) => [String(item._id), item]));
  return items.map((item, index) => {
    const stockItem = stockById.get(String(item.stockItemId));
    if (!stockItem) throw createError(`Item ${index + 1}: stock item not found`, 404);
    return {
      stockItemId: stockItem._id,
      itemName: stockItem.itemName,
      unit: stockItem.unit,
      quantity: item.quantity,
      purchasePrice: item.purchasePrice,
    };
  });
};

const receivePurchaseIntoStock = async (purchase, user) => {
  const stockItemIds = [...new Set(purchase.items.map((item) => String(item.stockItemId)))];
  const existingItems = await StockItem.countDocuments({ _id: { $in: stockItemIds } });
  if (existingItems !== stockItemIds.length) {
    throw createError('Every purchase item must reference an existing stock item', 400);
  }

  const originalStatus = purchase.purchaseStatus;
  const originalReceivedAt = purchase.receivedAt;
  const claimedPurchase = await Purchase.findOneAndUpdate(
    {
      _id: purchase._id,
      stockUpdated: { $ne: true },
      stockProcessing: { $ne: true },
      purchaseStatus: originalStatus,
    },
    {
      $set: {
        purchaseStatus: 'Received',
        receivedAt: purchase.receivedAt || new Date(),
        stockUpdatePending: true,
        stockProcessing: true,
      },
    },
    { returnDocument: 'after', runValidators: true },
  );

  if (!claimedPurchase) {
    const latestPurchase = await Purchase.findById(purchase._id);
    if (latestPurchase?.stockUpdated) return latestPurchase;
    throw createError('Purchase stock update is already in progress', 409);
  }

  const appliedMovements = [];
  try {
    for (const item of claimedPurchase.items) {
      const movement = await applyStockMovement({
        stockItemId: item.stockItemId,
        type: 'IN',
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        supplierId: claimedPurchase.supplierId,
        purchaseId: claimedPurchase._id,
        reference: claimedPurchase.purchaseNo,
        reason: 'Purchase Received',
        date: claimedPurchase.receivedAt,
        note: `Stock received from ${claimedPurchase.purchaseNo}.`,
        user,
      });
      appliedMovements.push(movement);
    }

    claimedPurchase.stockUpdated = true;
    claimedPurchase.stockUpdatePending = false;
    claimedPurchase.stockProcessing = false;
    claimedPurchase.stockUpdatedAt = new Date();
    await claimedPurchase.save();
    return claimedPurchase;
  } catch (error) {
    const rollbackResults = await Promise.allSettled(
      appliedMovements.reverse().map((movement) => rollbackAppliedMovement(movement)),
    );
    claimedPurchase.purchaseStatus = originalStatus;
    claimedPurchase.receivedAt = originalReceivedAt;
    claimedPurchase.stockUpdated = false;
    claimedPurchase.stockUpdatePending = originalStatus === 'Received';
    claimedPurchase.stockProcessing = false;
    claimedPurchase.stockUpdatedAt = null;
    await claimedPurchase.save();
    if (rollbackResults.some((result) => result.status === 'rejected')) {
      throw createError('Purchase receipt failed and stock requires manual review', 500);
    }
    throw error;
  }
};

export const getPurchases = async (request, response) => {
  const { page, limit } = getPagination(request.query);
  const filters = {};
  const search = request.query.search?.trim();

  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filters.$or = [
      { purchaseNo: pattern },
      { supplierName: pattern },
      { supplierInvoiceNo: pattern },
    ];
  }
  if (request.query.supplier) {
    if (mongoose.isValidObjectId(request.query.supplier)) {
      filters.supplierId = request.query.supplier;
    } else {
      filters.supplierName = new RegExp(escapeRegex(request.query.supplier.trim()), 'i');
    }
  }
  if (request.query.paymentStatus) filters.paymentStatus = request.query.paymentStatus;
  if (request.query.purchaseStatus) filters.purchaseStatus = request.query.purchaseStatus;

  const dateFilter = buildDateFilter(request.query.fromDate, request.query.toDate);
  if (dateFilter) filters.purchaseDate = dateFilter;

  const [purchases, total] = await Promise.all([
    Purchase.find(filters)
      .sort({ purchaseDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Purchase.countDocuments(filters),
  ]);

  return sendSuccess(response, {
    message: 'Purchases fetched successfully',
    data: purchases,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

export const getPurchase = async (request, response) => {
  const purchase = await findPurchase(request.params.id);
  return sendSuccess(response, { message: 'Purchase fetched successfully', data: purchase });
};

export const createPurchase = async (request, response) => {
  const supplier = await findSupplier(request.body.supplierId);
  const validatedItems = await getValidatedPurchaseItems(request.body.items);
  const totals = calculatePurchaseTotals(
    validatedItems,
    request.body.discount,
    request.body.additionalCharges,
  );
  const payment = calculatePayment(
    totals.finalAmount,
    request.body.paidAmount,
    request.body.paymentType,
  );
  const purchaseStatus = request.body.purchaseStatus || 'Draft';
  if (!['Draft', 'Ordered'].includes(purchaseStatus)) {
    throw createError('New purchases must start as Draft or Ordered', 400);
  }
  const purchase = await Purchase.create({
    purchaseNo: generatePurchaseNo(),
    supplierId: supplier._id,
    supplierName: supplier.name,
    purchaseDate: request.body.purchaseDate || new Date(),
    supplierInvoiceNo: request.body.supplierInvoiceNo,
    notes: request.body.notes,
    purchaseStatus,
    orderedAt: purchaseStatus === 'Ordered' ? new Date() : null,
    receivedAt: null,
    cancelledAt: null,
    stockUpdatePending: false,
    ...totals,
    ...payment,
  });

  return sendSuccess(response, {
    statusCode: 201,
    message: 'Purchase created successfully',
    data: purchase,
  });
};

export const updatePurchase = async (request, response) => {
  const purchase = await findPurchase(request.params.id);
  if (['Received', 'Cancelled'].includes(purchase.purchaseStatus)) {
    throw createError(`${purchase.purchaseStatus} purchases cannot be edited`, 400);
  }

  let supplier;
  if (request.body.supplierId !== undefined) {
    supplier = await findSupplier(request.body.supplierId);
  }
  const validatedItems = request.body.items
    ? await getValidatedPurchaseItems(request.body.items)
    : purchase.items;
  const totals = calculatePurchaseTotals(
    validatedItems,
    request.body.discount ?? purchase.discount,
    request.body.additionalCharges ?? purchase.additionalCharges,
  );
  const payment = calculatePayment(
    totals.finalAmount,
    purchase.paidAmount,
    request.body.paymentType ?? purchase.paymentType,
  );

  if (supplier) {
    purchase.supplierId = supplier._id;
    purchase.supplierName = supplier.name;
  }
  if (request.body.purchaseDate !== undefined) purchase.purchaseDate = request.body.purchaseDate;
  if (request.body.supplierInvoiceNo !== undefined) {
    purchase.supplierInvoiceNo = request.body.supplierInvoiceNo;
  }
  if (request.body.notes !== undefined) purchase.notes = request.body.notes;
  purchase.set({ ...totals, ...payment });
  await purchase.save();

  return sendSuccess(response, {
    message: 'Purchase updated successfully',
    data: purchase,
  });
};

export const updatePurchaseStatus = async (request, response) => {
  const nextStatus = request.body.purchaseStatus || request.body.status;
  if (!nextStatus) throw createError('Purchase status is required', 400);

  const purchase = await findPurchase(request.params.id);
  if (nextStatus === purchase.purchaseStatus) {
    if (nextStatus === 'Received' && !purchase.stockUpdated) {
      const receivedPurchase = await receivePurchaseIntoStock(purchase, request.userId);
      return sendSuccess(response, {
        message: 'Purchase received and stock updated successfully',
        data: receivedPurchase,
      });
    }
    return sendSuccess(response, { message: 'Purchase status is unchanged', data: purchase });
  }

  const allowedTransitions = {
    Draft: ['Ordered', 'Received', 'Cancelled'],
    Ordered: ['Received', 'Cancelled'],
    Received: [],
    Cancelled: [],
  };
  if (!allowedTransitions[purchase.purchaseStatus]?.includes(nextStatus)) {
    throw createError(
      `Purchase status cannot change from ${purchase.purchaseStatus} to ${nextStatus}`,
      400,
    );
  }

  if (nextStatus === 'Received') {
    const receivedPurchase = await receivePurchaseIntoStock(purchase, request.userId);
    return sendSuccess(response, {
      message: 'Purchase received and stock updated successfully',
      data: receivedPurchase,
    });
  }

  purchase.purchaseStatus = nextStatus;
  if (nextStatus === 'Ordered') purchase.orderedAt = new Date();
  if (nextStatus === 'Cancelled') {
    purchase.cancelledAt = new Date();
    purchase.stockUpdatePending = false;
    purchase.stockProcessing = false;
  }
  await purchase.save();

  return sendSuccess(response, {
    message: `Purchase marked as ${nextStatus}`,
    data: purchase,
  });
};

export const updatePurchasePayment = async (request, response) => {
  if (request.body.paidAmount === undefined) {
    throw createError('Paid amount is required', 400);
  }

  const purchase = await findPurchase(request.params.id);
  if (purchase.purchaseStatus === 'Cancelled') {
    throw createError('Payment cannot be updated for a cancelled purchase', 400);
  }
  const payment = calculatePayment(
    purchase.finalAmount,
    request.body.paidAmount,
    request.body.paymentType || purchase.paymentType,
  );
  purchase.set(payment);
  await purchase.save();

  return sendSuccess(response, {
    message: 'Purchase payment updated successfully',
    data: purchase,
  });
};

export const deletePurchase = async (request, response) => {
  const purchase = await findPurchase(request.params.id);
  if (!['Draft', 'Cancelled'].includes(purchase.purchaseStatus)) {
    throw createError('Only draft or cancelled purchases can be deleted', 400);
  }
  await purchase.deleteOne();
  return sendSuccess(response, { message: 'Purchase deleted successfully', data: purchase });
};
