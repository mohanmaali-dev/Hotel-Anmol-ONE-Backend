export const getStockStatus = (currentQuantity, minimumStock) => {
  if (currentQuantity <= 0) return 'Out of Stock';
  if (currentQuantity <= minimumStock) return 'Low Stock';
  return 'In Stock';
};

export const toPositiveQuantity = (value) => {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    const error = new Error('Quantity must be greater than 0');
    error.statusCode = 400;
    throw error;
  }
  return quantity;
};

export const toNonNegativeStockNumber = (value, fieldName) => {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) {
    const error = new Error(`${fieldName} cannot be negative`);
    error.statusCode = 400;
    throw error;
  }
  return number;
};
