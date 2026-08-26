import mongoose from 'mongoose';

import { env } from '../config/env.js';

export const isTransactionUnsupportedError = (error) =>
  error?.code === 20 ||
  /transaction numbers are only allowed|transactions are not supported|does not support retryable writes/i.test(
    error?.message || '',
  );

export const runInTransaction = async (
  work,
  fallback,
  { allowProductionFallback = false } = {},
) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (
      isTransactionUnsupportedError(error) &&
      fallback &&
      (env.nodeEnv !== 'production' || allowProductionFallback)
    ) {
      return fallback();
    }
    if (isTransactionUnsupportedError(error)) {
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
