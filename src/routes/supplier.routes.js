import { Router } from 'express';

import * as supplierController from '../controllers/supplier.controller.js';
import { auth } from '../middlewares/authenticate.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

export const supplierRouter = Router();

supplierRouter.use(auth());
supplierRouter.get(
  '/',
  authorize('suppliers', 'view'),
  asyncHandler(supplierController.getSuppliers),
);
supplierRouter.get(
  '/:id',
  authorize('suppliers', 'view'),
  asyncHandler(supplierController.getSupplier),
);
supplierRouter.post(
  '/',
  authorize('suppliers', 'create'),
  asyncHandler(supplierController.createSupplier),
);
supplierRouter.put(
  '/:id',
  authorize('suppliers', 'edit'),
  asyncHandler(supplierController.updateSupplier),
);
supplierRouter.delete(
  '/:id',
  authorize('suppliers', 'delete'),
  asyncHandler(supplierController.deleteSupplier),
);
