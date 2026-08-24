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

  return number;
};

export const calculateOrderTotals = (items, discountValue = 0, additionalChargesValue = 0) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw createValidationError('At least one order item is required');
  }

  const normalizedItems = items.map((item, index) => {
    const quantity = Number(item.quantity);
    const rate = Number(item.rate);

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

    return {
      menuItemId: item.menuItemId,
      itemName: item.itemName.trim(),
      quantity,
      rate,
      amount: quantity * rate,
    };
  });

  const discount = toNonNegativeNumber(discountValue, 'Discount');
  const additionalCharges = toNonNegativeNumber(additionalChargesValue, 'Additional charges');
  const subtotal = normalizedItems.reduce((total, item) => total + item.amount, 0);
  const finalAmount = subtotal - discount + additionalCharges;

  if (finalAmount < 0) {
    throw createValidationError('Final amount cannot be negative');
  }

  return { items: normalizedItems, subtotal, discount, additionalCharges, finalAmount };
};
