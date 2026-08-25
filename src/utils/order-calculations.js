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

export const calculateOrderTotals = (items, discountValue = 0, additionalChargesValue = 0) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw createValidationError('At least one order item is required');
  }

  const normalizedItems = items.map((item, index) => {
    const quantity = Number(item.quantity);
    const rate = roundMoney(item.rate);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw createValidationError(`Item ${index + 1}: quantity must be greater than 0`);
    }

    if (!Number.isFinite(rate) || rate < 0) {
      throw createValidationError(`Item ${index + 1}: rate cannot be negative`);
    }

    if (!item.menuItemId) {
      throw createValidationError(`Item ${index + 1}: menu item ID is required`);
    }

    if (!item.itemName?.trim()) {
      throw createValidationError(`Item ${index + 1}: item name is required`);
    }

    const normalizedItem = {
      menuItemId: item.menuItemId,
      itemName: item.itemName.trim(),
      quantity,
      rate,
      amount: roundMoney(quantity * rate),
      servingSize: String(item.servingSize || '').trim(),
    };

    if (item.recipeCaptured === true) {
      normalizedItem.recipeCaptured = true;
      normalizedItem.trackStock = item.trackStock === true;
      normalizedItem.ingredients = Array.isArray(item.ingredients)
        ? item.ingredients.map((ingredient) => ({
            stockItemId: ingredient.stockItemId,
            stockItemName: ingredient.stockItemName,
            quantityUsed: ingredient.quantityUsed,
            unit: ingredient.unit,
          }))
        : [];
    }

    return normalizedItem;
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
