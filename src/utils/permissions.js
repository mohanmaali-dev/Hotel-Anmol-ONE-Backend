import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  USER_ROLES,
} from '../modules/users/user.constants.js';

const allActions = [...PERMISSION_ACTIONS];
const permission = (module, actions) => ({ module, actions });

const rolePermissions = {
  Admin: PERMISSION_MODULES.map((module) => permission(module, [...allActions])),
  Manager: [
    ...PERMISSION_MODULES.filter((module) => !['users', 'settings'].includes(module)).map(
      (module) => permission(module, [...allActions]),
    ),
    permission('users', ['view']),
    permission('settings', ['view', 'edit']),
  ],
  Cashier: [
    permission('dashboard', ['view']),
    permission('orders', ['view', 'create', 'edit']),
    permission('billing', ['view', 'create', 'edit']),
    permission('sales', ['view']),
    permission('stock', ['view']),
    permission('menu', ['view']),
    permission('reports', ['view']),
  ],
  Waiter: [
    permission('dashboard', ['view']),
    permission('orders', ['view', 'create', 'edit']),
    permission('billing', ['view']),
    permission('stock', ['view']),
    permission('menu', ['view']),
  ],
  Staff: [
    permission('dashboard', ['view']),
    permission('orders', ['view']),
    permission('stock', ['view', 'edit']),
    permission('menu', ['view']),
    permission('expenses', ['view', 'create']),
  ],
};

const createError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const getCanonicalRole = (role) => {
  if (role === 'admin') return 'Admin';
  if (role === 'user') return 'Staff';
  return role;
};

export const getDefaultPermissions = (role) =>
  (rolePermissions[getCanonicalRole(role)] || []).map(({ module, actions }) => ({
    module,
    actions: [...actions],
  }));

export const normalizePermissions = (permissions, role) => {
  if (!USER_ROLES.includes(role)) throw createError('A valid user role is required');
  if (role === 'Admin' || permissions === undefined) return getDefaultPermissions(role);
  if (!Array.isArray(permissions)) throw createError('Permissions must be an array');

  const normalized = new Map();
  permissions.forEach((entry) => {
    const module = String(entry.module || '')
      .trim()
      .toLowerCase();
    if (!PERMISSION_MODULES.includes(module)) {
      throw createError(`Invalid permission module: ${entry.module || 'empty'}`);
    }
    if (!Array.isArray(entry.actions)) {
      throw createError(`Permissions for ${module} must be an array`);
    }
    const actions = [...new Set(entry.actions.map((action) => String(action).toLowerCase()))];
    if (actions.some((action) => !PERMISSION_ACTIONS.includes(action))) {
      throw createError(`Invalid permission action for ${module}`);
    }
    normalized.set(module, actions);
  });
  return [...normalized].map(([module, actions]) => ({ module, actions }));
};

export const getEffectivePermissions = (user) => {
  const role = getCanonicalRole(user.role);
  if (role === 'Admin') return getDefaultPermissions('Admin');
  if (user.permissions?.length) {
    return user.permissions.map(({ module, actions }) => ({ module, actions: [...actions] }));
  }
  return getDefaultPermissions(role);
};

export const hasPermission = (user, module, action) =>
  getEffectivePermissions(user).some(
    (entry) => entry.module === module && entry.actions.includes(action),
  );
