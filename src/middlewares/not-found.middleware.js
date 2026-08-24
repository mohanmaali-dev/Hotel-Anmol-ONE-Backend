import { sendError } from '../utils/api-response.js';

export const notFoundHandler = (request, response) => {
  return sendError(response, {
    statusCode: 404,
    message: `Route ${request.method} ${request.originalUrl} not found`,
  });
};
