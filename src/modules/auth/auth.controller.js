import {
  accessCookieOptions,
  cookieClearOptions,
  refreshCookieOptions,
} from '../../config/cookies.js';
import { sendSuccess } from '../../utils/api-response.js';
import { serializeUser } from './auth.service.js';
import * as authService from './auth.service.js';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth.constants.js';

export const login = async (request, response) => {
  const result = await authService.login(request.body);
  response.cookie(ACCESS_COOKIE, result.accessToken, accessCookieOptions);
  response.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
  return sendSuccess(response, {
    message: 'Login successful',
    data: { user: result.user, token: result.accessToken },
  });
};

export const refresh = async (request, response) => {
  const result = await authService.refreshSession(request.cookies?.[REFRESH_COOKIE]);
  response.cookie(ACCESS_COOKIE, result.accessToken, accessCookieOptions);
  response.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
  return sendSuccess(response, {
    message: 'Session refreshed successfully',
    data: { user: result.user, token: result.accessToken },
  });
};

export const getCurrentUser = async (request, response) =>
  sendSuccess(response, {
    message: 'User fetched successfully',
    data: serializeUser(request.user),
  });

export const logout = async (request, response) => {
  await authService.revokeSession(request.cookies?.[REFRESH_COOKIE]);
  response.clearCookie(ACCESS_COOKIE, cookieClearOptions);
  response.clearCookie(REFRESH_COOKIE, cookieClearOptions);
  return sendSuccess(response, { message: 'Logout successful' });
};
