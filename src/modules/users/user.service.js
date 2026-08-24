import {
  getDefaultPermissions,
  getEffectivePermissions,
  normalizePermissions,
} from '../../utils/permissions.js';
import { User } from './user.model.js';

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeEmail = (email) => email?.trim().toLowerCase() || undefined;
const normalizeUsername = (username) => username?.trim().toLowerCase();

const getActiveStatus = (status, fallback = true) => {
  if (status === undefined) return fallback;
  if (!['Active', 'Inactive'].includes(status)) {
    throw createError('Status must be Active or Inactive', 400);
  }
  return status === 'Active';
};

export const serializeUser = (user) => {
  const value = user.toObject ? user.toObject() : { ...user };
  delete value.password;
  value.status = value.isActive ? 'Active' : 'Inactive';
  value.permissions = getEffectivePermissions(value);
  return value;
};

const validatePassword = (password, confirmPassword) => {
  if (typeof password !== 'string' || password.length < 8) {
    throw createError('Password must be at least 8 characters', 400);
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw createError('Password and confirm password do not match', 400);
  }
};

const ensureUniqueUser = async ({ username, email, phone, excludeId }) => {
  const checks = [];
  if (username) checks.push({ username });
  if (email) checks.push({ email });
  if (phone) checks.push({ phone: phone.trim() });
  if (!checks.length) return;
  const query = { $or: checks };
  if (excludeId) query._id = { $ne: excludeId };
  const duplicate = await User.findOne(query).select('username email phone');
  if (!duplicate) return;
  if (duplicate.username === username) throw createError('Username is already registered', 409);
  if (email && duplicate.email === email) throw createError('Email is already registered', 409);
  throw createError('Phone is already registered', 409);
};

export const createUser = async (data) => {
  validatePassword(data.password, data.confirmPassword);
  const username = normalizeUsername(data.username);
  const email = normalizeEmail(data.email);
  const role = data.role || 'Staff';
  const permissions = normalizePermissions(data.permissions, role);
  await ensureUniqueUser({ username, email, phone: data.phone });

  const user = await User.create({
    name: data.fullName ?? data.name,
    username,
    email,
    phone: data.phone,
    password: data.password,
    role,
    permissions,
    isActive: getActiveStatus(data.status, data.isActive !== false),
  });
  return serializeUser(user);
};

export const getUsers = async (query) => {
  const page = Math.max(Math.floor(Number(query.page)) || 1, 1);
  const limit = Math.min(Math.max(Math.floor(Number(query.limit)) || 20, 1), 100);
  const sortBy = ['name', 'username', 'email', 'role', 'createdAt', 'updatedAt'].includes(
    query.sortBy,
  )
    ? query.sortBy
    : 'createdAt';
  const filters = {};
  if (query.role) filters.role = query.role;
  if (query.status) filters.isActive = query.status === 'Active';
  const search = query.search?.trim();
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filters.$or = [
      { name: pattern },
      { username: pattern },
      { email: pattern },
      { phone: pattern },
    ];
  }
  const [users, total] = await Promise.all([
    User.find(filters)
      .sort({ [sortBy]: query.sortOrder === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filters),
  ]);
  return {
    users: users.map(serializeUser),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

export const getUserById = async (id) => {
  const user = await User.findById(id);
  if (!user) throw createError('User not found', 404);
  return serializeUser(user);
};

export const updateUser = async (id, data, currentUserId) => {
  const user = await User.findById(id).select('+password');
  if (!user) throw createError('User not found', 404);
  const updatingSelf = String(user._id) === String(currentUserId);
  if (updatingSelf && (data.status === 'Inactive' || data.isActive === false)) {
    throw createError('You cannot deactivate your own user account', 400);
  }
  if (updatingSelf && data.role !== undefined && data.role !== user.role) {
    throw createError('You cannot change your own role', 400);
  }
  const username = data.username !== undefined ? normalizeUsername(data.username) : user.username;
  const email = data.email !== undefined ? normalizeEmail(data.email) : user.email;
  const phone = data.phone ?? user.phone;
  await ensureUniqueUser({ username, email, phone, excludeId: user._id });

  if (data.fullName !== undefined || data.name !== undefined) {
    user.name = data.fullName ?? data.name;
  }
  if (data.username !== undefined) user.username = username;
  if (data.email !== undefined) user.email = email;
  if (data.phone !== undefined) user.phone = data.phone;
  const roleChanged = data.role !== undefined && data.role !== user.role;
  if (data.role !== undefined) user.role = data.role;
  if (data.permissions !== undefined) {
    user.permissions = normalizePermissions(data.permissions, user.role);
  } else if (roleChanged) {
    user.permissions = getDefaultPermissions(user.role);
  }
  if (data.status !== undefined) user.isActive = getActiveStatus(data.status);
  else if (data.isActive !== undefined) user.isActive = Boolean(data.isActive);
  if (data.password !== undefined) {
    validatePassword(data.password, data.confirmPassword);
    user.password = data.password;
  }
  await user.save();
  return serializeUser(user);
};

export const deleteUser = async (id, currentUserId) => {
  if (String(id) === String(currentUserId)) {
    throw createError('You cannot delete your own user account', 400);
  }
  const user = await User.findByIdAndDelete(id);
  if (!user) throw createError('User not found', 404);
};
