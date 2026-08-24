import { Router } from 'express';

import * as saleController from '../controllers/sale.controller.js';
import { auth } from '../middlewares/authenticate.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

export const saleRouter = Router();

saleRouter.use(auth());
saleRouter.get(
  '/summary',
  authorize('sales', 'view'),
  asyncHandler(saleController.getSalesSummary),
);
saleRouter.get('/', authorize('sales', 'view'), asyncHandler(saleController.getSales));
saleRouter.get('/:id', authorize('sales', 'view'), asyncHandler(saleController.getSale));
