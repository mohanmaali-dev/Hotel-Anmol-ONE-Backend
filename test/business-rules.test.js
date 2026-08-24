import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateRequiredIngredients,
  combineRequiredIngredients,
} from '../src/utils/menu-stock.js';
import { calculateOrderTotals } from '../src/utils/order-calculations.js';
import { calculatePayment } from '../src/utils/payment-calculations.js';
import { calculatePurchaseTotals } from '../src/utils/purchase-calculations.js';
import { getStockStatus, toPositiveQuantity } from '../src/utils/stock-calculations.js';

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
  assert.throws(() => calculatePayment(390, 391, 'Cash'), /cannot exceed/);
});

test('stock status and quantities enforce inventory rules', () => {
  assert.equal(getStockStatus(0, 5), 'Out of Stock');
  assert.equal(getStockStatus(5, 5), 'Low Stock');
  assert.equal(getStockStatus(6, 5), 'In Stock');
  assert.throws(() => toPositiveQuantity(0), /greater than 0/);
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
