import { StockItem } from '../models/stock-item.model.js';
import { roundStockQuantity, toPositiveQuantity } from './stock-calculations.js';

export const calculateRequiredIngredients = (menuItem, orderedQuantity = 1) => {
  const quantity = toPositiveQuantity(orderedQuantity);
  if (!menuItem.trackStock) return [];

  return menuItem.ingredients.map((ingredient) => ({
    stockItemId: ingredient.stockItemId,
    stockItemName: ingredient.stockItemName,
    unit: ingredient.stockUnit || ingredient.unit,
    recipeUnit: ingredient.unit,
    quantityPerItem: ingredient.stockQuantityUsed || ingredient.quantityUsed,
    requiredQuantity: roundStockQuantity(
      (ingredient.stockQuantityUsed || ingredient.quantityUsed) * quantity,
    ),
  }));
};

export const combineRequiredIngredients = (menuItemQuantities) => {
  const combined = new Map();

  menuItemQuantities.forEach(({ menuItem, quantity }) => {
    calculateRequiredIngredients(menuItem, quantity).forEach((ingredient) => {
      const key = String(ingredient.stockItemId);
      const current = combined.get(key);
      if (current) {
        current.requiredQuantity = roundStockQuantity(
          current.requiredQuantity + ingredient.requiredQuantity,
        );
      }
      else {
        combined.set(key, {
          stockItemId: ingredient.stockItemId,
          stockItemName: ingredient.stockItemName,
          unit: ingredient.unit,
          requiredQuantity: ingredient.requiredQuantity,
        });
      }
    });
  });

  return [...combined.values()];
};

export const checkStockRequirements = async (requirements) => {
  if (requirements.length === 0) {
    return { available: true, ingredients: [] };
  }

  const stockItems = await StockItem.find({
    _id: { $in: requirements.map((ingredient) => ingredient.stockItemId) },
  })
    .select('itemName currentQuantity unit status')
    .lean();
  const stockById = new Map(stockItems.map((item) => [String(item._id), item]));

  const ingredients = requirements.map((requirement) => {
    const stockItem = stockById.get(String(requirement.stockItemId));
    const currentQuantity = stockItem?.currentQuantity ?? 0;
    const sufficient = Boolean(stockItem) && currentQuantity >= requirement.requiredQuantity;

    return {
      ...requirement,
      stockItemName: stockItem?.itemName || requirement.stockItemName,
      unit: stockItem?.unit || requirement.unit,
      currentQuantity,
      sufficient,
      shortage: Math.max(0, requirement.requiredQuantity - currentQuantity),
    };
  });

  return {
    available: ingredients.every((ingredient) => ingredient.sufficient),
    ingredients,
  };
};

export const checkIngredientAvailability = async (menuItem, orderedQuantity = 1) => {
  const requirements = calculateRequiredIngredients(menuItem, orderedQuantity);
  const availability = await checkStockRequirements(requirements);
  return { ...availability, trackStock: menuItem.trackStock };
};
