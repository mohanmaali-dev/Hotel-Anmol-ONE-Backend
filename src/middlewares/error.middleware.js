import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { sendError } from '../utils/api-response.js';

export const errorHandler = (error, request, response, _next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  let errors;

  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(error.errors).map((validationError) => validationError.message);
  }

  if (error.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${error.path}`;
  }

  if (error.code === 11000) {
    statusCode = 409;
    message = `${Object.keys(error.keyValue || {})[0] || 'Value'} already exists`;
  }

  if (statusCode === 500 && env.nodeEnv === 'production') {
    message = 'Internal server error';
  }

  if (statusCode >= 500) {
    logger.error(`${request.method} ${request.path}: ${error.message || 'Unknown server error'}`);
  }

  return sendError(response, {
    statusCode,
    message,
    errors,
    items: error.items,
    dependencies: error.dependencies,
  });
};
