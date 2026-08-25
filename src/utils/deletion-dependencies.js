import mongoose from 'mongoose';

import { User } from '../modules/users/user.model.js';
import { Bill } from '../models/bill.model.js';
import { Expense } from '../models/expense.model.js';
import { MenuCategory } from '../models/menu-category.model.js';
import { MenuItem } from '../models/menu-item.model.js';
import { Order } from '../models/order.model.js';
import { Purchase } from '../models/purchase.model.js';
import { Sale } from '../models/sale.model.js';
import { StockCategory } from '../models/stock-category.model.js';
import { StockHistory } from '../models/stock-history.model.js';
import { StockItem } from '../models/stock-item.model.js';
import { Supplier } from '../models/supplier.model.js';

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const entityModels = {
  order: Order,
  purchase: Purchase,
  supplier: Supplier,
  'stock-item': StockItem,
  'stock-category': StockCategory,
  'menu-item': MenuItem,
  'menu-category': MenuCategory,
  expense: Expense,
  user: User,
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const referenceGroup = async ({ model, filter, select, module, label, guidance, record }) => {
  const [count, documents] = await Promise.all([
    model.countDocuments(filter),
    model.find(filter).select(select).sort({ createdAt: -1, date: -1 }).limit(5).lean(),
  ]);
  if (!count) return null;
  return {
    module,
    label,
    count,
    guidance,
    records: documents.map(record),
  };
};

const fixedGroup = ({ module, label, guidance, record }) => ({
  module,
  label,
  count: 1,
  guidance,
  records: [record],
});

const getEntityLabel = (type, entity) => {
  if (type === 'order') return entity.orderNo;
  if (type === 'purchase') return entity.purchaseNo;
  if (type === 'supplier') return entity.name;
  if (type === 'stock-item') return entity.itemName;
  if (type === 'stock-category') return entity.name;
  if (type === 'menu-item') return entity.itemName;
  if (type === 'menu-category') return entity.name;
  if (type === 'expense') return entity.expenseNo;
  if (type === 'user') return entity.name;
  return String(entity._id);
};

export const getDeletionDependencies = async (type, id) => {
  const model = entityModels[type];
  if (!model) throw createError('Unsupported record type', 400);
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid record ID', 400);

  const entity = await model.findById(id).lean();
  if (!entity) throw createError('Record not found', 404);

  const checks = [];

  if (type === 'order') {
    checks.push(
      referenceGroup({
        model: Bill,
        filter: { orderId: id },
        select: 'billNo paymentStatus',
        module: 'Billing',
        label: 'Bills',
        guidance: 'This order has a bill, so the order must be kept.',
        record: (row) => ({
          id: row._id,
          label: `Bill #${row.billNo}`,
          status: row.paymentStatus,
          path: `/billing/${row._id}`,
        }),
      }),
      referenceGroup({
        model: Sale,
        filter: { orderId: id },
        select: 'saleNo paymentStatus',
        module: 'Sales',
        label: 'Sales',
        guidance: 'This order is included in sales, so the order must be kept.',
        record: (row) => ({
          id: row._id,
          label: `Sale #${row.saleNo}`,
          status: row.paymentStatus,
          path: `/sales/${row._id}`,
        }),
      }),
      referenceGroup({
        model: StockHistory,
        filter: { orderId: id },
        select: 'reference reason type quantity',
        module: 'Stock',
        label: 'Stock entries',
        guidance: 'Stock was used for this order, so the order must be kept.',
        record: (row) => ({
          id: row._id,
          label: row.reference || `${row.reason} · ${row.type} ${row.quantity}`,
          path: '/stock/history',
        }),
      }),
    );
    if (entity.orderStatus === 'Completed' || entity.stockDeducted) {
      checks.push(
        Promise.resolve(
          fixedGroup({
            module: 'Orders',
            label: 'Completed order',
            guidance: 'A completed order must be kept.',
            record: {
              id,
              label: `Order #${entity.orderNo}`,
              status: entity.orderStatus,
              path: `/orders/${id}`,
            },
          }),
        ),
      );
    }
  }

  if (type === 'purchase') {
    checks.push(
      referenceGroup({
        model: StockHistory,
        filter: { purchaseId: id },
        select: 'reference type quantity',
        module: 'Stock',
        label: 'Stock entries',
        guidance: 'Stock was added from this purchase, so the purchase must be kept.',
        record: (row) => ({
          id: row._id,
          label: row.reference || `${row.type} ${row.quantity}`,
          path: '/stock/history',
        }),
      }),
    );
    if (!['Draft', 'Cancelled'].includes(entity.purchaseStatus) || entity.stockUpdated) {
      checks.push(
        Promise.resolve(
          fixedGroup({
            module: 'Purchases',
            label: 'Purchase status',
            guidance:
              entity.purchaseStatus === 'Ordered'
                ? 'Cancel this purchase first.'
                : 'A received purchase must be kept.',
            record: {
              id,
              label: `Purchase #${entity.purchaseNo}`,
              status: entity.purchaseStatus,
              path: `/purchases/${id}`,
            },
          }),
        ),
      );
    }
  }

  if (type === 'supplier') {
    checks.push(
      referenceGroup({
        model: Purchase,
        filter: { supplierId: id },
        select: 'purchaseNo purchaseStatus',
        module: 'Purchases',
        label: 'Purchases',
        guidance: 'This supplier has purchases. Make the supplier Inactive instead.',
        record: (row) => ({
          id: row._id,
          label: `Purchase #${row.purchaseNo}`,
          status: row.purchaseStatus,
          path: `/purchases/${row._id}`,
        }),
      }),
      referenceGroup({
        model: StockItem,
        filter: { supplierId: id },
        select: 'itemName status',
        module: 'Stock',
        label: 'Stock items',
        guidance: 'Choose another supplier for these stock items first.',
        record: (row) => ({ id: row._id, label: row.itemName, status: row.status, path: '/stock' }),
      }),
      referenceGroup({
        model: StockHistory,
        filter: { supplierId: id },
        select: 'reference reason',
        module: 'Stock',
        label: 'Stock entries',
        guidance: 'This supplier was used in stock entries. Make the supplier Inactive instead.',
        record: (row) => ({
          id: row._id,
          label: row.reference || row.reason || 'Stock entry',
          path: '/stock/history',
        }),
      }),
    );
  }

  if (type === 'stock-item') {
    checks.push(
      referenceGroup({
        model: MenuItem,
        filter: { 'ingredients.stockItemId': id },
        select: 'itemName availability',
        module: 'Menu',
        label: 'Menu items',
        guidance: 'Remove this ingredient from these menu items first.',
        record: (row) => ({
          id: row._id,
          label: row.itemName,
          status: row.availability,
          path: `/menu/items/${row._id}`,
        }),
      }),
      referenceGroup({
        model: Purchase,
        filter: { 'items.stockItemId': id },
        select: 'purchaseNo purchaseStatus',
        module: 'Purchases',
        label: 'Purchases',
        guidance: 'This stock item has been purchased before, so it must be kept.',
        record: (row) => ({
          id: row._id,
          label: `Purchase #${row.purchaseNo}`,
          status: row.purchaseStatus,
          path: `/purchases/${row._id}`,
        }),
      }),
      referenceGroup({
        model: StockHistory,
        filter: { stockItemId: id },
        select: 'reference reason type quantity',
        module: 'Stock',
        label: 'Stock entries',
        guidance: 'This item has stock entries, so it must be kept.',
        record: (row) => ({
          id: row._id,
          label: row.reference || `${row.reason} · ${row.type} ${row.quantity}`,
          path: `/stock/history?item=${id}`,
        }),
      }),
    );
    if (Number(entity.currentQuantity) > 0) {
      checks.push(
        Promise.resolve(
          fixedGroup({
            module: 'Stock',
            label: 'Stock still available',
            guidance: 'Make the stock quantity zero first.',
            record: {
              id,
              label: `${entity.currentQuantity} ${entity.unit} available`,
              status: entity.status,
              path: '/stock',
            },
          }),
        ),
      );
    }
  }

  if (type === 'stock-category') {
    checks.push(
      referenceGroup({
        model: StockItem,
        filter: { category: new RegExp(`^${escapeRegex(entity.name)}$`, 'i') },
        select: 'itemName status',
        module: 'Stock',
        label: 'Stock items',
        guidance: 'Move these items to another category first.',
        record: (row) => ({ id: row._id, label: row.itemName, status: row.status, path: '/stock' }),
      }),
    );
  }

  if (type === 'menu-item') {
    checks.push(
      referenceGroup({
        model: Order,
        filter: { 'items.menuItemId': id },
        select: 'orderNo orderStatus',
        module: 'Orders',
        label: 'Orders',
        guidance: 'This menu item was ordered before. Make it Unavailable instead.',
        record: (row) => ({
          id: row._id,
          label: `Order #${row.orderNo}`,
          status: row.orderStatus,
          path: `/orders/${row._id}`,
        }),
      }),
    );
  }

  if (type === 'menu-category') {
    checks.push(
      referenceGroup({
        model: MenuItem,
        filter: { categoryId: id },
        select: 'itemName availability',
        module: 'Menu',
        label: 'Menu items',
        guidance: 'Move these menu items to another category first.',
        record: (row) => ({
          id: row._id,
          label: row.itemName,
          status: row.availability,
          path: `/menu/items/${row._id}`,
        }),
      }),
    );
  }

  if (type === 'user') {
    checks.push(
      referenceGroup({
        model: Order,
        filter: { biller: id },
        select: 'orderNo orderStatus',
        module: 'Orders',
        label: 'Orders',
        guidance: 'This user has handled orders. Make the user Inactive instead.',
        record: (row) => ({
          id: row._id,
          label: `Order #${row.orderNo}`,
          status: row.orderStatus,
          path: `/orders/${row._id}`,
        }),
      }),
      referenceGroup({
        model: Bill,
        filter: { biller: id },
        select: 'billNo paymentStatus',
        module: 'Billing',
        label: 'Bills',
        guidance: 'This user has handled bills. Make the user Inactive instead.',
        record: (row) => ({
          id: row._id,
          label: `Bill #${row.billNo}`,
          status: row.paymentStatus,
          path: `/billing/${row._id}`,
        }),
      }),
      referenceGroup({
        model: Sale,
        filter: { biller: id },
        select: 'saleNo paymentStatus',
        module: 'Sales',
        label: 'Sales',
        guidance: 'This user has handled sales. Make the user Inactive instead.',
        record: (row) => ({
          id: row._id,
          label: `Sale #${row.saleNo}`,
          status: row.paymentStatus,
          path: `/sales/${row._id}`,
        }),
      }),
      referenceGroup({
        model: Expense,
        filter: { addedBy: id },
        select: 'expenseNo category',
        module: 'Expenses',
        label: 'Expenses',
        guidance: 'This user has added expenses. Make the user Inactive instead.',
        record: (row) => ({
          id: row._id,
          label: `Expense #${row.expenseNo}`,
          status: row.category,
          path: `/expenses/${row._id}`,
        }),
      }),
      referenceGroup({
        model: StockHistory,
        filter: { user: id },
        select: 'reference reason',
        module: 'Stock',
        label: 'Stock entries',
        guidance: 'This user has added stock entries. Make the user Inactive instead.',
        record: (row) => ({
          id: row._id,
          label: row.reference || row.reason || 'Stock entry',
          path: '/stock/history',
        }),
      }),
    );
  }

  const dependencies = (await Promise.all(checks)).filter(Boolean);
  return {
    entity: { type, id: String(entity._id), label: getEntityLabel(type, entity) },
    canDelete: dependencies.length === 0,
    dependencies,
  };
};

export const assertNoDeletionDependencies = async (type, id) => {
  const result = await getDeletionDependencies(type, id);
  if (result.canDelete) return result;
  const error = createError('This record is being used and cannot be deleted yet', 409);
  error.dependencies = result.dependencies;
  throw error;
};
