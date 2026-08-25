import { roundMoney } from './money.js';

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const toNonNegativeNumber = (value, fieldName) => {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) {
    throw createValidationError(`${fieldName} cannot be negative`);
  }
  return roundMoney(number);
};

export const calculatePurchaseTotals = (items, discountValue = 0, additionalChargesValue = 0) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw createValidationError('At least one purchase item is required');
  }

  const stockItemIds = items.map((item) => String(item.stockItemId || ''));
  if (new Set(stockItemIds).size !== stockItemIds.length) {
    throw createValidationError('The same stock item cannot be added more than once');
  }

  const normalizedItems = items.map((item, index) => {
    const quantity = Number(item.quantity);
    const purchasePrice = roundMoney(item.purchasePrice);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw createValidationError(`Item ${index + 1}: quantity must be greater than 0`);
    }
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      throw createValidationError(`Item ${index + 1}: purchase price cannot be negative`);
    }
    if (!item.stockItemId) {
      throw createValidationError(`Item ${index + 1}: stock item ID is required`);
    }
    if (!item.itemName?.trim()) {
      throw createValidationError(`Item ${index + 1}: item name is required`);
    }
    if (!item.unit?.trim()) {
      throw createValidationError(`Item ${index + 1}: unit is required`);
    }

    return {
      stockItemId: item.stockItemId,
      itemName: item.itemName.trim(),
      quantity,
      unit: item.unit.trim(),
      purchasePrice,
      amount: roundMoney(quantity * purchasePrice),
    };
  });

  const discount = toNonNegativeNumber(discountValue, 'Discount');
  const additionalCharges = toNonNegativeNumber(additionalChargesValue, 'Additional charges');
  const subtotal = roundMoney(
    normalizedItems.reduce((total, item) => total + item.amount, 0),
  );
  const finalAmount = roundMoney(subtotal - discount + additionalCharges);

  if (finalAmount < 0) {
    throw createValidationError('Final amount cannot be negative');
  }

  return { items: normalizedItems, subtotal, discount, additionalCharges, finalAmount };
};
