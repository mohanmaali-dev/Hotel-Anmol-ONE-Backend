import { Router } from 'express';

import { getDashboard } from '../controllers/dashboard.controller.js';
import { auth } from '../middlewares/authenticate.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

export const dashboardRouter = Router();

dashboardRouter.use(auth(), authorize('dashboard', 'view'));
dashboardRouter.get('/', asyncHandler(getDashboard));
