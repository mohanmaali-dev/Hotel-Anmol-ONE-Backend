import { env } from './env.js';

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin.replace(/\/+$/, ''))) {
      return callback(null, true);
    }
    const error = new Error('This website is not allowed to access the API');
    error.statusCode = 403;
    return callback(error);
  },
  credentials: true,
  optionsSuccessStatus: 204,
};
