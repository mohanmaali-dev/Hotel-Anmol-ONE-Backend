import { accessCookieOptions, refreshCookieOptions } from '../../config/cookies.js';
import { sendSuccess } from '../../utils/api-response.js';
import { serializeUser } from './auth.service.js';
import * as authService from './auth.service.js';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth.constants.js';

export const login = async (request, response) => {
  const result = await authService.login(request.body);
  response.cookie(ACCESS_COOKIE, result.accessToken, accessCookieOptions);
  return sendSuccess(response, {
    message: 'Login successful',
    data: { user: result.user, token: result.accessToken },
  });
};

export const getCurrentUser = async (request, response) =>
  sendSuccess(response, {
    message: 'User fetched successfully',
    data: serializeUser(request.user),
  });

export const logout = async (_request, response) => {
  response.clearCookie(ACCESS_COOKIE, accessCookieOptions);
  response.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
  return sendSuccess(response, { message: 'Logout successful' });
};
