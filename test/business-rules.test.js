import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateRequiredIngredients,
  combineRequiredIngredients,
} from '../src/utils/menu-stock.js';
import { buildDateFilter } from '../src/utils/date-range.js';
import { calculateOrderTotals } from '../src/utils/order-calculations.js';
import { calculatePayment } from '../src/utils/payment-calculations.js';
import { calculatePurchaseTotals } from '../src/utils/purchase-calculations.js';
import { getStockStatus, toPositiveQuantity } from '../src/utils/stock-calculations.js';
import { convertIngredientToStockUnit } from '../src/utils/unit-conversion.js';

const objectId = '507f1f77bcf86cd799439011';

test('order totals are calculated from quantity and rate', () => {
  const totals = calculateOrderTotals(
    [
      { menuItemId: objectId, itemName: 'Burger', quantity: 2, rate: 150 },
      { menuItemId: objectId, itemName: 'Tea', quantity: 1, rate: 40 },
    ],
    20,
    10,
  );
  assert.equal(totals.subtotal, 340);
  assert.equal(totals.finalAmount, 330);
  assert.deepEqual(
    totals.items.map((item) => item.amount),
    [300, 40],
  );
});

test('order total rejects a negative final amount', () => {
  assert.throws(
    () =>
      calculateOrderTotals(
        [{ menuItemId: objectId, itemName: 'Tea', quantity: 1, rate: 40 }],
        50,
        0,
      ),
    /Final amount cannot be negative/,
  );
});

test('money calculations are rounded to two decimal places', () => {
  const totals = calculateOrderTotals(
    [{ menuItemId: objectId, itemName: 'Tea', quantity: 3, rate: 0.1 }],
    0.1,
    0.2,
  );
  assert.equal(totals.items[0].amount, 0.3);
  assert.equal(totals.subtotal, 0.3);
  assert.equal(totals.finalAmount, 0.4);
  assert.equal(calculatePayment(0.4, 0.1, 'Cash').dueAmount, 0.3);
});

test('date filters use the restaurant timezone', () => {
  const range = buildDateFilter('2026-08-25', '2026-08-25');
  assert.equal(range.$gte.toISOString(), '2026-08-24T18:30:00.000Z');
  assert.equal(range.$lt.toISOString(), '2026-08-25T18:30:00.000Z');
});

test('order items keep the recipe captured when the order is created', () => {
  const totals = calculateOrderTotals([
    {
      menuItemId: objectId,
      itemName: 'Burger',
      quantity: 1,
      rate: 100,
      servingSize: '1 Plate',
      recipeCaptured: true,
      trackStock: true,
      ingredients: [
        {
          stockItemId: objectId,
          stockItemName: 'Bun',
          quantityUsed: 1,
          unit: 'Piece',
        },
      ],
    },
  ]);
  assert.equal(totals.items[0].recipeCaptured, true);
  assert.equal(totals.items[0].servingSize, '1 Plate');
  assert.equal(totals.items[0].ingredients[0].stockItemName, 'Bun');
});

test('purchase and payment totals remain consistent', () => {
  const totals = calculatePurchaseTotals(
    [{ stockItemId: objectId, itemName: 'Rice', quantity: 5, unit: 'kg', purchasePrice: 80 }],
    25,
    15,
  );
  assert.equal(totals.subtotal, 400);
  assert.equal(totals.finalAmount, 390);
  assert.deepEqual(calculatePayment(totals.finalAmount, 100, 'UPI'), {
    paidAmount: 100,
    dueAmount: 290,
    paymentType: 'UPI',
    paymentStatus: 'Partial',
  });
  assert.equal(calculatePayment(390, 0, 'Cash').paymentType, null);
  assert.throws(() => calculatePayment(390, 391, 'Cash'), /cannot exceed/);
  assert.throws(() => calculatePayment(390, 10, 'Cheque'), /must be Cash, UPI, or Card/);
});

test('a purchase cannot contain the same stock item twice', () => {
  assert.throws(
    () =>
      calculatePurchaseTotals([
        { stockItemId: objectId, itemName: 'Rice', quantity: 1, unit: 'kg', purchasePrice: 80 },
        { stockItemId: objectId, itemName: 'Rice', quantity: 2, unit: 'kg', purchasePrice: 82 },
      ]),
    /cannot be added more than once/,
  );
});

test('stock status and quantities enforce inventory rules', () => {
  assert.equal(getStockStatus(0, 5), 'Out of Stock');
  assert.equal(getStockStatus(5, 5), 'Low Stock');
  assert.equal(getStockStatus(6, 5), 'In Stock');
  assert.throws(() => toPositiveQuantity(0), /greater than 0/);
  assert.equal(toPositiveQuantity(0.1 + 0.2), 0.3);
});

test('recipe requirements combine duplicate ingredients', () => {
  const burger = {
    trackStock: true,
    ingredients: [
      { stockItemId: 'bun', stockItemName: 'Bun', quantityUsed: 1, unit: 'Piece' },
      { stockItemId: 'sauce', stockItemName: 'Sauce', quantityUsed: 20, unit: 'ml' },
    ],
  };
  const sandwich = {
    trackStock: true,
    ingredients: [
      { stockItemId: 'bread', stockItemName: 'Bread', quantityUsed: 2, unit: 'Piece' },
      { stockItemId: 'sauce', stockItemName: 'Sauce', quantityUsed: 10, unit: 'ml' },
    ],
  };
  assert.equal(calculateRequiredIngredients(burger, 2)[1].requiredQuantity, 40);
  const combined = combineRequiredIngredients([
    { menuItem: burger, quantity: 2 },
    { menuItem: sandwich, quantity: 1 },
  ]);
  assert.equal(combined.find((item) => item.stockItemId === 'sauce').requiredQuantity, 50);
});

test('recipe quantities convert to the stock item unit', () => {
  const recipe = convertIngredientToStockUnit({
    quantity: 250,
    ingredientUnit: 'gram',
    stockUnit: 'kg',
  });
  assert.equal(recipe.stockQuantityUsed, 0.25);
  assert.throws(
    () => convertIngredientToStockUnit({ quantity: 1, ingredientUnit: 'ml', stockUnit: 'kg' }),
    /cannot be used/,
  );
});

test('order recipe deduction uses the converted stock quantity snapshot', () => {
  const menuItem = {
    trackStock: true,
    ingredients: [
      {
        stockItemId: 'paneer',
        stockItemName: 'Paneer',
        quantityUsed: 250,
        unit: 'gram',
        stockQuantityUsed: 0.25,
        stockUnit: 'kg',
        conversionFactor: 0.001,
      },
    ],
  };
  const requirement = calculateRequiredIngredients(menuItem, 3)[0];
  assert.equal(requirement.requiredQuantity, 0.75);
  assert.equal(requirement.unit, 'kg');
});
