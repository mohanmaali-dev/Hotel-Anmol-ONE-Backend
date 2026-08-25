import { roundStockQuantity, toPositiveQuantity } from './stock-calculations.js';

const createError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const units = {
  gram: { family: 'weight', factor: 1 },
  kg: { family: 'weight', factor: 1000 },
  ml: { family: 'volume', factor: 1 },
  litre: { family: 'volume', factor: 1000 },
  piece: { family: 'piece', factor: 1 },
  slice: { family: 'slice', factor: 1 },
  bottle: { family: 'bottle', factor: 1 },
  packet: { family: 'packet', factor: 1 },
  box: { family: 'box', factor: 1 },
  crate: { family: 'crate', factor: 1 },
  bag: { family: 'bag', factor: 1 },
};

const aliases = {
  g: 'gram',
  grams: 'gram',
  kilogram: 'kg',
  kilograms: 'kg',
  millilitre: 'ml',
  millilitres: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  l: 'litre',
  liter: 'litre',
  liters: 'litre',
  litres: 'litre',
  pieces: 'piece',
  pcs: 'piece',
  slices: 'slice',
  bottles: 'bottle',
  packets: 'packet',
  boxes: 'box',
  crates: 'crate',
  bags: 'bag',
};

export const normalizeUnit = (value, fieldName = 'Unit') => {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  const unit = aliases[raw] || raw;
  if (!units[unit]) throw createError(`${fieldName} is not supported`);
  return unit;
};

export const getStandardConversionFactor = (fromValue, toValue) => {
  const from = normalizeUnit(fromValue, 'Ingredient unit');
  const to = normalizeUnit(toValue, 'Stock unit');
  if (from === to) return 1;
  if (units[from].family !== units[to].family) return null;
  return units[from].factor / units[to].factor;
};

export const convertIngredientToStockUnit = ({
  quantity: quantityValue,
  ingredientUnit,
  stockUnit,
}) => {
  const quantity = toPositiveQuantity(quantityValue);
  const normalizedIngredientUnit = normalizeUnit(ingredientUnit || stockUnit, 'Ingredient unit');
  const normalizedStockUnit = normalizeUnit(stockUnit, 'Stock unit');
  const conversionFactor = getStandardConversionFactor(
    normalizedIngredientUnit,
    normalizedStockUnit,
  );
  if (conversionFactor === null) {
    throw createError(
      `${normalizedIngredientUnit} cannot be used for stock kept in ${normalizedStockUnit}`,
    );
  }
  return {
    quantityUsed: quantity,
    unit: normalizedIngredientUnit,
    stockQuantityUsed: roundStockQuantity(quantity * conversionFactor),
    stockUnit: normalizedStockUnit,
    conversionFactor: roundStockQuantity(conversionFactor),
  };
};
