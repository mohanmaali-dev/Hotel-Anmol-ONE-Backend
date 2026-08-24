import { Router } from 'express';

import { getDatabaseStatus } from '../config/database.js';
import { sendSuccess } from '../utils/api-response.js';

export const healthRouter = Router();

healthRouter.get('/', (_request, response) =>
  sendSuccess(response, {
    message: 'Restaurant Management API is running',
    data: { database: getDatabaseStatus() },
  }),
);
