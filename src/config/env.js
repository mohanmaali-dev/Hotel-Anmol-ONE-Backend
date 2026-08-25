import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV || 'development';

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const parseOrigins = (value) =>
  String(value || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

const configuredFrontendOrigins = parseOrigins(process.env.FRONTEND_URL);
const developmentOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...configuredFrontendOrigins,
];

export const env = {
  nodeEnv,
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI,
  mongoRetryWrites: parseBoolean(process.env.MONGODB_RETRY_WRITES, false),
  frontendUrl: configuredFrontendOrigins[0],
  corsOrigins: [
    ...new Set(nodeEnv === 'production' ? configuredFrontendOrigins : developmentOrigins),
  ],
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '10kb',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 500,
  loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
  trustProxy: Number(process.env.TRUST_PROXY ?? (nodeEnv === 'production' ? 1 : 0)),
  appTimezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  emailHost: process.env.EMAIL_HOST,
  emailEnabled: process.env.EMAIL_ENABLED === 'true',
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
  emailPort: Number(process.env.EMAIL_PORT) || 587,
  emailSecure: process.env.EMAIL_SECURE === 'true',
  emailUser: process.env.EMAIL_USER,
  emailPassword: process.env.EMAIL_PASSWORD,
  emailFrom: process.env.EMAIL_FROM,
  clientUrl: configuredFrontendOrigins[0] || 'http://localhost:5173',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  jwtRefreshCookieDays: Number(process.env.JWT_REFRESH_COOKIE_DAYS) || 7,
};

export const validateEnvironment = () => {
  const missing = [];
  if (!env.mongoUri) missing.push('MONGODB_URI');
  if (!env.jwtAccessSecret) missing.push('JWT_SECRET');
  if (env.nodeEnv === 'production' && !env.frontendUrl) missing.push('FRONTEND_URL');

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (env.nodeEnv === 'production' && env.jwtAccessSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters in production');
  }
  if (env.nodeEnv === 'production' && env.jwtRefreshSecret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must contain at least 32 characters in production');
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: env.appTimezone }).format();
  } catch {
    throw new Error(`Invalid APP_TIMEZONE: ${env.appTimezone}`);
  }
  env.corsOrigins.forEach((origin) => {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid FRONTEND_URL origin: ${origin}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error(`FRONTEND_URL must contain valid origins without paths: ${origin}`);
    }
  });
};
