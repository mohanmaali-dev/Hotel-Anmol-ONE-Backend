import mongoose from 'mongoose';

import { StockHistory } from '../models/stock-history.model.js';
import { StockItem } from '../models/stock-item.model.js';
import {
  getStockStatus,
  roundStockQuantity,
  toNonNegativeStockNumber,
  toPositiveQuantity,
} from './stock-calculations.js';

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const optionalObjectId = (value, fieldName) => {
  if (!value) return null;
  if (!mongoose.isValidObjectId(value)) throw createError(`Invalid ${fieldName}`, 400);
  return new mongoose.Types.ObjectId(value);
};

const statusExpression = (quantityExpression) => ({
  $switch: {
    branches: [
      { case: { $eq: [quantityExpression, 0] }, then: 'Out of Stock' },
      { case: { $lte: [quantityExpression, '$minimumStock'] }, then: 'Low Stock' },
    ],
    default: 'In Stock',
  },
});

const rollbackMovement = async ({ itemBefore, type, quantity, historyId }) => {
  const quantityExpression =
    type === 'IN'
      ? { $round: [{ $subtract: ['$currentQuantity', quantity] }, 6] }
      : { $round: [{ $add: ['$currentQuantity', quantity] }, 6] };
  const fields = {
    currentQuantity: quantityExpression,
    status: statusExpression(quantityExpression),
  };

  if (type === 'IN') {
    fields.purchasePrice = itemBefore.purchasePrice;
    fields.supplierId = itemBefore.supplierId || null;
  }

  await StockItem.findByIdAndUpdate(itemBefore._id, [{ $set: fields }], {
    updatePipeline: true,
  });
  if (historyId) await StockHistory.findByIdAndDelete(historyId);
};

export const applyStockMovement = async ({
  stockItemId,
  type,
  quantity: quantityValue,
  purchasePrice: purchasePriceValue,
  supplierId: supplierValue,
  purchaseId: purchaseValue,
  orderId: orderValue,
  reference,
  reason,
  date,
  note,
  user,
}) => {
  if (!mongoose.isValidObjectId(stockItemId)) throw createError('Invalid stock item ID', 400);
  if (!['IN', 'OUT'].includes(type))
    throw createError('Stock movement type must be IN or OUT', 400);

  const quantity = toPositiveQuantity(quantityValue);
  const itemBefore = await StockItem.findById(stockItemId);
  if (!itemBefore) throw createError('Stock item not found', 404);

  const supplierId = optionalObjectId(supplierValue, 'supplier ID');
  const purchaseId = optionalObjectId(purchaseValue, 'purchase ID');
  const orderId = optionalObjectId(orderValue, 'order ID');
  const userId = optionalObjectId(user, 'user ID');
  let purchasePrice;
  if (purchasePriceValue !== undefined) {
    purchasePrice = toNonNegativeStockNumber(purchasePriceValue, 'Purchase price');
  }

  const quantityExpression =
    type === 'IN'
      ? { $round: [{ $add: ['$currentQuantity', quantity] }, 6] }
      : { $round: [{ $subtract: ['$currentQuantity', quantity] }, 6] };
  const fields = {
    currentQuantity: quantityExpression,
    status: statusExpression(quantityExpression),
    updatedAt: new Date(),
  };
  if (type === 'IN' && purchasePrice !== undefined) {
    fields.purchasePrice = purchasePrice;
  }
  if (type === 'IN' && supplierId) fields.supplierId = supplierId;

  const itemQuery = { _id: itemBefore._id };
  if (type === 'OUT') itemQuery.currentQuantity = { $gte: quantity };
  const item = await StockItem.findOneAndUpdate(itemQuery, [{ $set: fields }], {
    returnDocument: 'after',
    updatePipeline: true,
  });

  if (!item) {
    const exists = await StockItem.exists({ _id: itemBefore._id });
    if (!exists) throw createError('Stock item not found', 404);
    throw createError(
      `Insufficient stock. Available quantity is ${itemBefore.currentQuantity} ${itemBefore.unit}`,
      400,
    );
  }

  const previousQuantity =
    type === 'IN'
      ? roundStockQuantity(item.currentQuantity - quantity)
      : roundStockQuantity(item.currentQuantity + quantity);
  let history;
  try {
    history = await StockHistory.create({
      stockItemId: item._id,
      itemName: item.itemName,
      type,
      quantity,
      previousQuantity,
      newQuantity: item.currentQuantity,
      reference: reference || '',
      reason: reason || (type === 'IN' ? 'Stock In' : 'Other'),
      date: date || new Date(),
      user: userId,
      supplierId,
      purchaseId,
      orderId,
      note: note || '',
    });
  } catch (error) {
    await rollbackMovement({ itemBefore, type, quantity });
    throw error;
  }

  return { item, history, itemBefore, type, quantity };
};

export const rollbackAppliedMovement = (movement) =>
  rollbackMovement({
    itemBefore: movement.itemBefore,
    type: movement.type,
    quantity: movement.quantity,
    historyId: movement.history._id,
  });

export const calculateCurrentStatus = getStockStatus;
