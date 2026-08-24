import { connectDatabase } from '../config/database.js';
// change
export const ensureDatabaseConnection = async (_request, _response, next) => {
  try {
    await connectDatabase();
    return next();
  } catch {
    const error = new Error('Database is temporarily unavailable');
    error.statusCode = 503;
    return next(error);
  }
};
