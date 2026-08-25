import { comparePassword } from '../../utils/password.js';
import { createAccessToken, createRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { getEffectivePermissions } from '../../utils/permissions.js';
import { hashToken } from '../../utils/token.js';
import { User } from '../users/user.model.js';
import { AuthToken } from './auth-token.model.js';

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

const createSession = async (user) => {
  const accessToken = createAccessToken(user.id);
  const refreshToken = createRefreshToken(user.id);
  const payload = verifyRefreshToken(refreshToken);
  await AuthToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(payload.exp * 1000),
  });
  return { user: serializeUser(user), accessToken, refreshToken };
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

  return createSession(user);
};

export const refreshSession = async (refreshToken) => {
  if (!refreshToken) throw createError('Session has expired. Please log in again', 401);

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    await AuthToken.deleteOne({ tokenHash: hashToken(refreshToken) });
    throw createError('Session has expired. Please log in again', 401);
  }

  const storedToken = await AuthToken.findOneAndDelete({
    tokenHash: hashToken(refreshToken),
    user: payload.userId,
    expiresAt: { $gt: new Date() },
  });
  if (!storedToken) throw createError('Session has expired. Please log in again', 401);

  const user = await User.findById(payload.userId);
  if (!user || !user.isActive) {
    await AuthToken.deleteMany({ user: payload.userId });
    throw createError('User account is unavailable', 403);
  }
  return createSession(user);
};

export const revokeSession = async (refreshToken) => {
  if (!refreshToken) return;
  await AuthToken.deleteOne({ tokenHash: hashToken(refreshToken) });
};
