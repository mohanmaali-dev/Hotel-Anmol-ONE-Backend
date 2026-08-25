import mongoose from 'mongoose';

import { MenuCategory } from '../models/menu-category.model.js';
import { MenuItem } from '../models/menu-item.model.js';
import { StockItem } from '../models/stock-item.model.js';
import { sendSuccess } from '../utils/api-response.js';
import { assertNoDeletionDependencies } from '../utils/deletion-dependencies.js';
import { roundMoney } from '../utils/money.js';
import { toNonNegativeStockNumber, toPositiveQuantity } from '../utils/stock-calculations.js';
import { convertIngredientToStockUnit } from '../utils/unit-conversion.js';

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getPagination = (query) => {
  const page = Math.max(Math.floor(Number(query.page)) || 1, 1);
  const limit = Math.min(Math.max(Math.floor(Number(query.limit)) || 20, 1), 100);
  return { page, limit };
};

const getSellingPrice = (value) => {
  if (value === undefined || value === null || value === '') {
    throw createError('Selling price is required', 400);
  }
  return roundMoney(toNonNegativeStockNumber(value, 'Selling price'));
};

const getServingSize = (value) => {
  const servingSize = String(value || '').trim();
  if (servingSize.length > 80) throw createError('Serving size cannot exceed 80 characters', 400);
  return servingSize;
};

const findCategory = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid menu category ID', 400);
  const category = await MenuCategory.findById(id);
  if (!category) throw createError('Menu category not found', 404);
  return category;
};

const findMenuItem = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid menu item ID', 400);
  const item = await MenuItem.findById(id).populate('categoryId', 'name description status');
  if (!item) throw createError('Menu item not found', 404);
  return item;
};

const prepareIngredients = async (ingredients, trackStock) => {
  if (!trackStock && ingredients === undefined) return undefined;
  if (!Array.isArray(ingredients)) throw createError('Ingredients must be an array', 400);
  if (trackStock && ingredients.length === 0) {
    throw createError('At least one ingredient is required when stock tracking is enabled', 400);
  }

  const stockItemIds = ingredients.map((ingredient) => {
    const id = ingredient.stockItemId;
    if (!mongoose.isValidObjectId(id)) throw createError('Invalid stock item ID', 400);
    return String(id);
  });
  if (new Set(stockItemIds).size !== stockItemIds.length) {
    throw createError('Duplicate stock items are not allowed in a recipe', 400);
  }

  const stockItems = await StockItem.find({ _id: { $in: stockItemIds } });
  if (stockItems.length !== stockItemIds.length) {
    throw createError('Every ingredient must reference an existing stock item', 400);
  }
  const stockById = new Map(stockItems.map((item) => [String(item._id), item]));

  return ingredients.map((ingredient) => {
    const stockItem = stockById.get(String(ingredient.stockItemId));
    const conversion = convertIngredientToStockUnit({
      quantity: ingredient.quantityUsed,
      ingredientUnit: ingredient.unit || stockItem.unit,
      stockUnit: stockItem.unit,
    });
    return {
      stockItemId: stockItem._id,
      stockItemName: stockItem.itemName,
      quantityUsed: toPositiveQuantity(ingredient.quantityUsed),
      unit: conversion.unit,
      stockQuantityUsed: conversion.stockQuantityUsed,
      stockUnit: conversion.stockUnit,
      conversionFactor: conversion.conversionFactor,
    };
  });
};

export const getCategories = async (request, response) => {
  const { page, limit } = getPagination(request.query);
  const filters = {};
  if (request.query.status) filters.status = request.query.status;
  const [categories, total] = await Promise.all([
    MenuCategory.find(filters)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    MenuCategory.countDocuments(filters),
  ]);
  return sendSuccess(response, {
    message: 'Menu categories fetched successfully',
    data: categories,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

export const createCategory = async (request, response) => {
  const category = await MenuCategory.create({
    name: request.body.name,
    description: request.body.description,
    status: request.body.status,
  });
  return sendSuccess(response, {
    statusCode: 201,
    message: 'Menu category created successfully',
    data: category,
  });
};

export const updateCategory = async (request, response) => {
  const category = await findCategory(request.params.id);
  ['name', 'description', 'status'].forEach((field) => {
    if (request.body[field] !== undefined) category[field] = request.body[field];
  });
  await category.save();
  return sendSuccess(response, {
    message: 'Menu category updated successfully',
    data: category,
  });
};

export const deleteCategory = async (request, response) => {
  const category = await findCategory(request.params.id);
  await assertNoDeletionDependencies('menu-category', category._id);
  await category.deleteOne();
  return sendSuccess(response, {
    message: 'Menu category deleted successfully',
    data: category,
  });
};

export const getMenuItems = async (request, response) => {
  const { page, limit } = getPagination(request.query);
  const filters = {};
  const search = request.query.search?.trim();
  if (search) filters.itemName = new RegExp(escapeRegex(search), 'i');
  if (request.query.availability) filters.availability = request.query.availability;
  if (request.query.category) {
    if (mongoose.isValidObjectId(request.query.category)) {
      filters.categoryId = request.query.category;
    } else {
      const categories = await MenuCategory.find({
        name: new RegExp(escapeRegex(request.query.category.trim()), 'i'),
      }).select('_id');
      filters.categoryId = { $in: categories.map((category) => category._id) };
    }
  }

  const [items, total] = await Promise.all([
    MenuItem.find(filters)
      .populate('categoryId', 'name description status')
      .sort({ itemName: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    MenuItem.countDocuments(filters),
  ]);
  return sendSuccess(response, {
    message: 'Menu items fetched successfully',
    data: items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

export const getMenuItem = async (request, response) => {
  const item = await findMenuItem(request.params.id);
  return sendSuccess(response, { message: 'Menu item fetched successfully', data: item });
};

export const createMenuItem = async (request, response) => {
  const category = await findCategory(request.body.categoryId);
  const trackStock = request.body.trackStock === true;
  const ingredients = await prepareIngredients(request.body.ingredients, trackStock);
  const item = await MenuItem.create({
    itemName: request.body.itemName,
    categoryId: category._id,
    sellingPrice: getSellingPrice(request.body.sellingPrice),
    servingSize: getServingSize(request.body.servingSize),
    description: request.body.description,
    availability: request.body.availability,
    trackStock,
    ingredients: ingredients || [],
  });
  await item.populate('categoryId', 'name description status');
  return sendSuccess(response, {
    statusCode: 201,
    message: 'Menu item created successfully',
    data: item,
  });
};

export const updateMenuItem = async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) throw createError('Invalid menu item ID', 400);
  const item = await MenuItem.findById(request.params.id);
  if (!item) throw createError('Menu item not found', 404);

  if (request.body.categoryId !== undefined) {
    const category = await findCategory(request.body.categoryId);
    item.categoryId = category._id;
  }
  const trackStock = request.body.trackStock ?? item.trackStock;
  let ingredients;
  if (request.body.ingredients !== undefined || (trackStock && !item.trackStock)) {
    ingredients = await prepareIngredients(
      request.body.ingredients ?? item.ingredients,
      trackStock,
    );
  }
  ['itemName', 'description', 'availability'].forEach((field) => {
    if (request.body[field] !== undefined) item[field] = request.body[field];
  });
  if (request.body.servingSize !== undefined) {
    item.servingSize = getServingSize(request.body.servingSize);
  }
  if (request.body.sellingPrice !== undefined) {
    item.sellingPrice = getSellingPrice(request.body.sellingPrice);
  }
  item.trackStock = trackStock;
  if (!trackStock) item.ingredients = [];
  else if (ingredients !== undefined) item.ingredients = ingredients;
  await item.save();
  await item.populate('categoryId', 'name description status');
  return sendSuccess(response, { message: 'Menu item updated successfully', data: item });
};

export const deleteMenuItem = async (request, response) => {
  const item = await findMenuItem(request.params.id);
  await assertNoDeletionDependencies('menu-item', item._id);
  await item.deleteOne();
  return sendSuccess(response, { message: 'Menu item deleted successfully', data: item });
};
