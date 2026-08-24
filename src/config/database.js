import mongoose from 'mongoose';

import { env } from './env.js';
import { logger } from './logger.js';

export const connectDatabase = async () => {
  if (!env.mongoUri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(env.mongoUri);
  logger.info('MongoDB connected');
};

export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  }
};
