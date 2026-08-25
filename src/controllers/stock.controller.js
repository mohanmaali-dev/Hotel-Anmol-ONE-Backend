import mongoose from 'mongoose';

import { User } from '../modules/users/user.model.js';
import { MenuItem } from '../models/menu-item.model.js';
import { Purchase } from '../models/purchase.model.js';
import { StockCategory } from '../models/stock-category.model.js';
import { StockHistory } from '../models/stock-history.model.js';
import { StockItem } from '../models/stock-item.model.js';
import { Supplier } from '../models/supplier.model.js';
import { sendSuccess } from '../utils/api-response.js';
import { buildDateFilter } from '../utils/date-range.js';
import { assertNoDeletionDependencies } from '../utils/deletion-dependencies.js';
import { toNonNegativeStockNumber } from '../utils/stock-calculations.js';
import { applyStockMovement } from '../utils/stock-movement.js';

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const defaultStockCategories = [
  'Grains & Flour',
  'Oil & Dairy',
  'Vegetables',
  'Spices',
  'Beverages',
  'Other',
];

const categoryNameKey = (value) => value.trim().toLocaleLowerCase('en-IN');

const exactNameRegex = (value) => new RegExp(`^${escapeRegex(value.trim())}$`, 'i');

const syncStockCategories = async () => {
  const [categoryCount, legacyNames] = await Promise.all([
    StockCategory.countDocuments(),
    StockItem.distinct('category'),
  ]);
  const names =
    categoryCount === 0
      ? [...new Set([...defaultStockCategories, ...legacyNames].filter(Boolean))]
      : legacyNames.filter(Boolean);

  if (!names.length) return;
  await StockCategory.bulkWrite(
    names.map((name) => ({
      updateOne: {
        filter: { nameKey: categoryNameKey(name) },
        update: {
          $setOnInsert: { name: name.trim(), nameKey: categoryNameKey(name), status: 'Active' },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
};

const findStockCategory = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid stock category ID', 400);
  const category = await StockCategory.findById(id);
  if (!category) throw createError('Stock category not found', 404);
  return category;
};

const getStockCategoryForItem = async (value) => {
  const name = value?.trim();
  if (!name) throw createError('Stock category is required', 400);
  const category = await StockCategory.findOne({ nameKey: categoryNameKey(name) });
  if (!category) throw createError('Please select an existing stock category', 400);
  if (category.status !== 'Active')
    throw createError('Please select an active stock category', 400);
  return category;
};

const getPagination = (query) => {
  const page = Math.max(Math.floor(Number(query.page)) || 1, 1);
  const limit = Math.min(Math.max(Math.floor(Number(query.limit)) || 20, 1), 100);
  return { page, limit };
};

const findStockItem = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid stock item ID', 400);
  const item = await StockItem.findById(id);
  if (!item) throw createError('Stock item not found', 404);
  return item;
};

export const getStockCategories = async (request, response) => {
  await syncStockCategories();
  const filters = {};
  if (request.query.status) filters.status = request.query.status;
  const categories = await StockCategory.find(filters).sort({ name: 1 });
  return sendSuccess(response, {
    message: 'Stock categories fetched successfully',
    data: categories,
  });
};

export const createStockCategory = async (request, response) => {
  const name = request.body.name?.trim();
  if (!name) throw createError('Category name is required', 400);
  if (await StockCategory.exists({ nameKey: categoryNameKey(name) })) {
    throw createError('A stock category with this name already exists', 409);
  }
  const category = await StockCategory.create({
    name,
    status: request.body.status || 'Active',
  });
  return sendSuccess(response, {
    statusCode: 201,
    message: 'Stock category created successfully',
    data: category,
  });
};

export const updateStockCategory = async (request, response) => {
  const category = await findStockCategory(request.params.id);
  const previousName = category.name;

  if (request.body.name !== undefined) {
    const name = request.body.name?.trim();
    if (!name) throw createError('Category name is required', 400);
    const duplicate = await StockCategory.exists({
      _id: { $ne: category._id },
      nameKey: categoryNameKey(name),
    });
    if (duplicate) throw createError('A stock category with this name already exists', 409);
    category.name = name;
  }
  if (request.body.status !== undefined) category.status = request.body.status;
  await category.save();

  if (category.name !== previousName) {
    try {
      await StockItem.updateMany(
        { category: exactNameRegex(previousName) },
        { $set: { category: category.name } },
      );
    } catch (error) {
      category.name = previousName;
      await category.save();
      throw error;
    }
  }

  return sendSuccess(response, {
    message: 'Stock category updated successfully',
    data: category,
  });
};

export const deleteStockCategory = async (request, response) => {
  const category = await findStockCategory(request.params.id);
  await assertNoDeletionDependencies('stock-category', category._id);
  await category.deleteOne();
  return sendSuccess(response, {
    message: 'Stock category deleted successfully',
    data: category,
  });
};

export const getStockItems = async (request, response) => {
  const { page, limit } = getPagination(request.query);
  const filters = {};
  const search = request.query.search?.trim();
  if (search) filters.itemName = new RegExp(escapeRegex(search), 'i');
  if (request.query.category) filters.category = request.query.category;
  if (request.query.status) filters.status = request.query.status;

  const [items, total] = await Promise.all([
    StockItem.find(filters)
      .sort({ itemName: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    StockItem.countDocuments(filters),
  ]);

  return sendSuccess(response, {
    message: 'Stock items fetched successfully',
    data: items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

export const getStockItem = async (request, response) => {
  const item = await findStockItem(request.params.id);
  return sendSuccess(response, { message: 'Stock item fetched successfully', data: item });
};

export const createStockItem = async (request, response) => {
  const category = await getStockCategoryForItem(request.body.category);
  const openingQuantity = toNonNegativeStockNumber(
    request.body.currentQuantity ?? request.body.openingQuantity,
    'Opening quantity',
  );
  const purchasePrice = toNonNegativeStockNumber(request.body.purchasePrice, 'Purchase price');
  const minimumStock = toNonNegativeStockNumber(request.body.minimumStock, 'Minimum stock');
  const item = await StockItem.create({
    itemName: request.body.itemName,
    category: category.name,
    unit: request.body.unit,
    currentQuantity: 0,
    purchasePrice,
    minimumStock,
    supplierId: request.body.supplierId || null,
  });

  let savedItem = item;
  if (openingQuantity > 0) {
    try {
      const result = await applyStockMovement({
        stockItemId: item._id,
        type: 'IN',
        quantity: openingQuantity,
        purchasePrice,
        supplierId: request.body.supplierId,
        reference: 'Opening Stock',
        reason: 'Opening Stock',
        date: request.body.date,
        note: 'Opening quantity added when the stock item was created.',
        user: request.userId,
      });
      savedItem = result.item;
    } catch (error) {
      await StockItem.findByIdAndDelete(item._id);
      throw error;
    }
  }

  return sendSuccess(response, {
    statusCode: 201,
    message: 'Stock item created successfully',
    data: savedItem,
  });
};

export const updateStockItem = async (request, response) => {
  if (request.body.currentQuantity !== undefined || request.body.openingQuantity !== undefined) {
    throw createError('Use Stock In or Stock Out to change current quantity', 400);
  }

  const item = await findStockItem(request.params.id);
  const previousItemName = item.itemName;
  if (request.body.unit !== undefined && request.body.unit !== item.unit) {
    const [usedInRecipe, usedInPurchase, hasHistory] = await Promise.all([
      MenuItem.exists({ 'ingredients.stockItemId': item._id }),
      Purchase.exists({ 'items.stockItemId': item._id }),
      StockHistory.exists({ stockItemId: item._id }),
    ]);
    if (usedInRecipe || usedInPurchase || hasHistory || item.currentQuantity > 0) {
      throw createError('The unit cannot be changed after this stock item has been used', 400);
    }
  }
  if (
    request.body.category !== undefined &&
    categoryNameKey(request.body.category) !== categoryNameKey(item.category)
  ) {
    const category = await getStockCategoryForItem(request.body.category);
    item.category = category.name;
  }
  const editableFields = ['itemName', 'supplierId'];
  editableFields.forEach((field) => {
    if (request.body[field] !== undefined) item[field] = request.body[field] || null;
  });
  if (request.body.purchasePrice !== undefined) {
    item.purchasePrice = toNonNegativeStockNumber(request.body.purchasePrice, 'Purchase price');
  }
  if (request.body.minimumStock !== undefined) {
    item.minimumStock = toNonNegativeStockNumber(request.body.minimumStock, 'Minimum stock');
  }
  await item.save();

  if (item.itemName !== previousItemName) {
    try {
      await MenuItem.updateMany(
        { 'ingredients.stockItemId': item._id },
        { $set: { 'ingredients.$[ingredient].stockItemName': item.itemName } },
        { arrayFilters: [{ 'ingredient.stockItemId': item._id }] },
      );
    } catch (error) {
      item.itemName = previousItemName;
      await item.save();
      throw error;
    }
  }

  return sendSuccess(response, { message: 'Stock item updated successfully', data: item });
};

export const deleteStockItem = async (request, response) => {
  const item = await findStockItem(request.params.id);
  await assertNoDeletionDependencies('stock-item', item._id);
  await item.deleteOne();
  return sendSuccess(response, { message: 'Stock item deleted successfully', data: item });
};

export const stockIn = async (request, response) => {
  if (request.body.purchaseId) {
    throw createError('Receive the purchase from the Purchases page to update stock', 400);
  }
  const result = await applyStockMovement({
    stockItemId: request.body.stockItemId,
    type: 'IN',
    quantity: request.body.quantity,
    purchasePrice: request.body.purchasePrice,
    supplierId: request.body.supplierId,
    purchaseId: request.body.purchaseId,
    reference: request.body.reference,
    reason: 'Stock In',
    date: request.body.date,
    note: request.body.note,
    user: request.userId,
  });

  return sendSuccess(response, {
    statusCode: 201,
    message: 'Stock added successfully',
    data: { item: result.item, history: result.history },
  });
};

export const stockOut = async (request, response) => {
  const allowedReasons = ['Kitchen Usage', 'Wastage', 'Damage', 'Adjustment', 'Other'];
  if (!allowedReasons.includes(request.body.reason)) {
    throw createError('A valid Stock Out reason is required', 400);
  }
  const result = await applyStockMovement({
    stockItemId: request.body.stockItemId,
    type: 'OUT',
    quantity: request.body.quantity,
    reference: request.body.reference,
    reason: request.body.reason,
    date: request.body.date,
    note: request.body.note,
    user: request.userId,
  });

  return sendSuccess(response, {
    statusCode: 201,
    message: 'Stock removed successfully',
    data: { item: result.item, history: result.history },
  });
};

export const getStockHistory = async (request, response) => {
  const { page, limit } = getPagination(request.query);
  const filters = {};
  if (request.query.item) {
    if (mongoose.isValidObjectId(request.query.item)) filters.stockItemId = request.query.item;
    else filters.itemName = new RegExp(escapeRegex(request.query.item.trim()), 'i');
  }
  if (request.query.type) filters.type = request.query.type.toUpperCase();
  const dateFilter = buildDateFilter(request.query.fromDate, request.query.toDate);
  if (dateFilter) filters.date = dateFilter;

  const [historyRows, total] = await Promise.all([
    StockHistory.find(filters)
      .populate({ path: 'supplierId', select: 'name', model: Supplier })
      .populate({ path: 'user', select: 'name', model: User })
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    StockHistory.countDocuments(filters),
  ]);
  const historyItemIds = [...new Set(historyRows.map((row) => String(row.stockItemId)))];
  const unitItems = historyItemIds.length
    ? await StockItem.find({ _id: { $in: historyItemIds } }).select('unit').lean()
    : [];
  const unitsByItem = new Map(unitItems.map((item) => [String(item._id), item.unit]));
  const history = historyRows.map((row) => ({
    ...row,
    unit: unitsByItem.get(String(row.stockItemId)) || '',
  }));

  return sendSuccess(response, {
    message: 'Stock history fetched successfully',
    data: history,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

export const getStockSummary = async (_request, response) => {
  const [summary] = await StockItem.aggregate([
    {
      $group: {
        _id: null,
        totalStockItems: { $sum: 1 },
        totalStockValue: { $sum: { $multiply: ['$currentQuantity', '$purchasePrice'] } },
        lowStockItems: {
          $sum: { $cond: [{ $eq: ['$status', 'Low Stock'] }, 1, 0] },
        },
        outOfStockItems: {
          $sum: { $cond: [{ $eq: ['$status', 'Out of Stock'] }, 1, 0] },
        },
      },
    },
    { $project: { _id: 0 } },
  ]);

  return sendSuccess(response, {
    message: 'Stock summary fetched successfully',
    data: summary || {
      totalStockItems: 0,
      totalStockValue: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
    },
  });
};
