import { Router } from 'express';

import * as billController from '../controllers/bill.controller.js';
import { auth } from '../middlewares/authenticate.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

export const billRouter = Router();

billRouter.use(auth());
billRouter.get('/', authorize('billing', 'view'), asyncHandler(billController.getBills));
billRouter.get('/:id', authorize('billing', 'view'), asyncHandler(billController.getBill));
billRouter.post(
  '/from-order/:orderId',
  authorize('billing', 'create'),
  asyncHandler(billController.createBillFromOrder),
);
billRouter.put(
  '/:id/payment',
  authorize('billing', 'edit'),
  asyncHandler(billController.updateBillPayment),
);
