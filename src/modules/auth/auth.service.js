import { comparePassword } from '../../utils/password.js';
import { createAccessToken } from '../../utils/jwt.js';
import { getEffectivePermissions } from '../../utils/permissions.js';
import { User } from '../users/user.model.js';

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const serializeUser = (user) => {
  const value = user.toObject ? user.toObject() : { ...user };
  delete value.password;
  value.status = value.isActive ? 'Active' : 'Inactive';
  value.permissions = getEffectivePermissions(value);
  return value;
};

export const login = async ({ usernameOrEmail, username, email, password }) => {
  const identifier = String(usernameOrEmail || username || email || '')
    .trim()
    .toLowerCase();
  if (!identifier || !password) throw createError('Username/email and password are required', 400);

  const user = await User.findOne({
    $or: [{ username: identifier }, { email: identifier }],
  }).select('+password');
  if (!user || !(await comparePassword(password, user.password))) {
    throw createError('Invalid username/email or password', 401);
  }
  if (!user.isActive) throw createError('User account is inactive', 403);

  return { user: serializeUser(user), accessToken: createAccessToken(user.id) };
};
