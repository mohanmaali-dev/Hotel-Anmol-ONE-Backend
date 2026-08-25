import mongoose from 'mongoose';

import { env } from '../config/env.js';

const transactionsUnsupported = (error) =>
  error?.code === 20 ||
  /transaction numbers are only allowed|transactions are not supported/i.test(error?.message || '');

export const runInTransaction = async (work, fallback) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (transactionsUnsupported(error) && env.nodeEnv !== 'production' && fallback) {
      return fallback();
    }
    if (transactionsUnsupported(error)) {
      const configurationError = new Error(
        'Database transactions are required for safe stock updates. Use a MongoDB replica set or Atlas cluster.',
      );
      configurationError.statusCode = 503;
      throw configurationError;
    }
    throw error;
  } finally {
    await session.endSession();
  }
};
