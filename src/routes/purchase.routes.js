import { Router } from 'express';

import * as purchaseController from '../controllers/purchase.controller.js';
import { auth } from '../middlewares/authenticate.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

export const purchaseRouter = Router();

purchaseRouter.use(auth());
purchaseRouter.get(
  '/',
  authorize('purchases', 'view'),
  asyncHandler(purchaseController.getPurchases),
);
purchaseRouter.get(
  '/:id',
  authorize('purchases', 'view'),
  asyncHandler(purchaseController.getPurchase),
);
purchaseRouter.post(
  '/',
  authorize('purchases', 'create'),
  asyncHandler(purchaseController.createPurchase),
);
purchaseRouter.put(
  '/:id',
  authorize('purchases', 'edit'),
  asyncHandler(purchaseController.updatePurchase),
);
purchaseRouter.put(
  '/:id/status',
  authorize('purchases', 'edit'),
  asyncHandler(purchaseController.updatePurchaseStatus),
);
purchaseRouter.put(
  '/:id/payment',
  authorize('purchases', 'edit'),
  asyncHandler(purchaseController.updatePurchasePayment),
);
purchaseRouter.delete(
  '/:id',
  authorize('purchases', 'delete'),
  asyncHandler(purchaseController.deletePurchase),
);
