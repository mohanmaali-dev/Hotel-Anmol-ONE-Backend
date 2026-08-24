import { Router } from 'express';

import * as reportController from '../controllers/report.controller.js';
import { auth } from '../middlewares/authenticate.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

export const reportRouter = Router();

reportRouter.use(auth(), authorize('reports', 'view'));
reportRouter.get('/sales', asyncHandler(reportController.getSalesReport));
reportRouter.get('/purchases', asyncHandler(reportController.getPurchaseReport));
reportRouter.get('/expenses', asyncHandler(reportController.getExpenseReport));
reportRouter.get('/stock', asyncHandler(reportController.getStockReport));
reportRouter.get('/payments', asyncHandler(reportController.getPaymentReport));
reportRouter.get('/orders', asyncHandler(reportController.getOrderReport));
