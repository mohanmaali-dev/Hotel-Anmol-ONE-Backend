import mongoose from 'mongoose';

import { env } from './env.js';
import { logger } from './logger.js';

let connectionPromise;

export const applyRetryWritesSetting = (mongoUri, retryWrites) => {
  const value = String(Boolean(retryWrites));
  if (/([?&])retryWrites=/i.test(mongoUri)) {
    return mongoUri.replace(/([?&])retryWrites=[^&]*/gi, `$1retryWrites=${value}`);
  }
  return `${mongoUri}${mongoUri.includes('?') ? '&' : '?'}retryWrites=${value}`;
};

mongoose.connection.on('disconnected', () => {
  connectionPromise = undefined;
});

export const connectDatabase = async () => {
  if (!env.mongoUri) {
    throw new Error('MONGODB_URI is required');
  }
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  const mongoUri = applyRetryWritesSetting(env.mongoUri, env.mongoRetryWrites);

  connectionPromise = mongoose
    .connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      // Some Mongo-compatible production providers do not implement retryable writes.
      // This explicit option also overrides retryWrites in an older connection URL.
      retryWrites: env.mongoRetryWrites,
    })
    .then(() => {
      logger.info('MongoDB connected');
      return mongoose.connection;
    })
    .catch((error) => {
      connectionPromise = undefined;
      logger.error(`MongoDB connection failed: ${error.message}`);
      throw error;
    });

  return connectionPromise;
};

export const getDatabaseStatus = () => {
  const statuses = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return statuses[mongoose.connection.readyState] || 'unknown';
};

export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    connectionPromise = undefined;
    logger.info('MongoDB disconnected');
  }
};
