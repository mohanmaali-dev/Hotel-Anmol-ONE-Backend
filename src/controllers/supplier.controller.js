import mongoose from 'mongoose';

import { Purchase } from '../models/purchase.model.js';
import { Supplier } from '../models/supplier.model.js';
import { sendSuccess } from '../utils/api-response.js';

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

const normalizeEmail = (email) => email?.trim().toLowerCase() || null;

const serializeSupplier = (supplier) => {
  const value = supplier.toObject ? supplier.toObject() : { ...supplier };
  const supplierName = value.name;
  delete value.name;
  return { ...value, supplierName };
};

const findSupplier = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw createError('Invalid supplier ID', 400);
  const supplier = await Supplier.findById(id);
  if (!supplier) throw createError('Supplier not found', 404);
  return supplier;
};

const ensureSupplierIsUnique = async ({ phone, email, excludeId }) => {
  const duplicateFields = [];
  if (phone?.trim()) duplicateFields.push({ phone: phone.trim() });
  if (email) duplicateFields.push({ email });
  if (duplicateFields.length === 0) return;

  const filters = { $or: duplicateFields };
  if (excludeId) filters._id = { $ne: excludeId };
  const duplicate = await Supplier.findOne(filters).select('phone email');
  if (!duplicate) return;
  if (phone?.trim() && duplicate.phone === phone.trim()) {
    throw createError('A supplier with this phone number already exists', 409);
  }
  throw createError('A supplier with this email already exists', 409);
};

export const getSuppliers = async (request, response) => {
  const { page, limit } = getPagination(request.query);
  const filters = {};
  const search = request.query.search?.trim();
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filters.$or = [
      { name: pattern },
      { contactPerson: pattern },
      { phone: pattern },
      { email: pattern },
    ];
  }
  if (request.query.status) filters.status = request.query.status;

  const [suppliers, total] = await Promise.all([
    Supplier.find(filters)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Supplier.countDocuments(filters),
  ]);
  return sendSuccess(response, {
    message: 'Suppliers fetched successfully',
    data: suppliers.map(serializeSupplier),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

export const getSupplier = async (request, response) => {
  const supplier = await findSupplier(request.params.id);
  const purchaseLimit = Math.min(
    Math.max(Math.floor(Number(request.query.purchaseLimit)) || 10, 1),
    50,
  );
  const [summary] = await Purchase.aggregate([
    { $match: { supplierId: supplier._id, purchaseStatus: { $ne: 'Cancelled' } } },
    {
      $group: {
        _id: null,
        totalPurchases: { $sum: 1 },
        totalPurchaseAmount: { $sum: '$finalAmount' },
        totalPaid: { $sum: '$paidAmount' },
        totalDue: { $sum: '$dueAmount' },
        lastPurchaseDate: { $max: '$purchaseDate' },
      },
    },
    { $project: { _id: 0 } },
  ]);
  const purchaseHistory = await Purchase.find({ supplierId: supplier._id })
    .select(
      'purchaseNo purchaseDate supplierInvoiceNo finalAmount paidAmount dueAmount paymentType paymentStatus purchaseStatus createdAt',
    )
    .sort({ purchaseDate: -1, createdAt: -1 })
    .limit(purchaseLimit)
    .lean();

  return sendSuccess(response, {
    message: 'Supplier fetched successfully',
    data: {
      supplier: serializeSupplier(supplier),
      purchaseSummary: summary || {
        totalPurchases: 0,
        totalPurchaseAmount: 0,
        totalPaid: 0,
        totalDue: 0,
        lastPurchaseDate: null,
      },
      purchaseHistory,
    },
  });
};

export const createSupplier = async (request, response) => {
  const email = normalizeEmail(request.body.email);
  await ensureSupplierIsUnique({ phone: request.body.phone, email });
  const supplier = await Supplier.create({
    name: request.body.supplierName ?? request.body.name,
    contactPerson: request.body.contactPerson,
    phone: request.body.phone,
    alternatePhone: request.body.alternatePhone,
    email,
    address: request.body.address,
    gstTaxNumber: request.body.gstTaxNumber,
    notes: request.body.notes,
    status: request.body.status,
  });
  return sendSuccess(response, {
    statusCode: 201,
    message: 'Supplier created successfully',
    data: serializeSupplier(supplier),
  });
};

export const updateSupplier = async (request, response) => {
  const supplier = await findSupplier(request.params.id);
  const phone = request.body.phone ?? supplier.phone;
  const email =
    request.body.email !== undefined ? normalizeEmail(request.body.email) : supplier.email;
  await ensureSupplierIsUnique({ phone, email, excludeId: supplier._id });

  if (request.body.supplierName !== undefined || request.body.name !== undefined) {
    supplier.name = request.body.supplierName ?? request.body.name;
  }
  [
    'contactPerson',
    'phone',
    'alternatePhone',
    'address',
    'gstTaxNumber',
    'notes',
    'status',
  ].forEach((field) => {
    if (request.body[field] !== undefined) supplier[field] = request.body[field];
  });
  supplier.email = email;
  await supplier.save();
  return sendSuccess(response, {
    message: 'Supplier updated successfully',
    data: serializeSupplier(supplier),
  });
};

export const deleteSupplier = async (request, response) => {
  const supplier = await findSupplier(request.params.id);
  const purchaseCount = await Purchase.countDocuments({ supplierId: supplier._id });
  if (purchaseCount > 0) {
    throw createError(
      'Supplier has purchase history and cannot be deleted. Mark the supplier Inactive instead',
      400,
    );
  }
  await supplier.deleteOne();
  return sendSuccess(response, {
    message: 'Supplier deleted successfully',
    data: serializeSupplier(supplier),
  });
};
