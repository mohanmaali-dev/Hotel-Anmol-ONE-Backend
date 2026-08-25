import { env } from './env.js';

const cookieSecurityOptions = {
  httpOnly: true,
  sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
  secure: env.nodeEnv === 'production',
  partitioned: env.nodeEnv === 'production',
  path: '/',
};

export const accessCookieOptions = {
  ...cookieSecurityOptions,
  maxAge: 15 * 60 * 1000,
};

export const refreshCookieOptions = {
  ...cookieSecurityOptions,
  maxAge: env.jwtRefreshCookieDays * 24 * 60 * 60 * 1000,
};

export const cookieClearOptions = cookieSecurityOptions;
