import { Router } from 'express';

import * as stockController from '../controllers/stock.controller.js';
import { auth } from '../middlewares/authenticate.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

export const stockRouter = Router();

stockRouter.use(auth());
stockRouter.get(
  '/categories',
  authorize('stock', 'view'),
  asyncHandler(stockController.getStockCategories),
);
stockRouter.post(
  '/categories',
  authorize('stock', 'create'),
  asyncHandler(stockController.createStockCategory),
);
stockRouter.put(
  '/categories/:id',
  authorize('stock', 'edit'),
  asyncHandler(stockController.updateStockCategory),
);
stockRouter.delete(
  '/categories/:id',
  authorize('stock', 'delete'),
  asyncHandler(stockController.deleteStockCategory),
);
stockRouter.get('/items', authorize('stock', 'view'), asyncHandler(stockController.getStockItems));
stockRouter.get(
  '/items/:id',
  authorize('stock', 'view'),
  asyncHandler(stockController.getStockItem),
);
stockRouter.post(
  '/items',
  authorize('stock', 'create'),
  asyncHandler(stockController.createStockItem),
);
stockRouter.put(
  '/items/:id',
  authorize('stock', 'edit'),
  asyncHandler(stockController.updateStockItem),
);
stockRouter.delete(
  '/items/:id',
  authorize('stock', 'delete'),
  asyncHandler(stockController.deleteStockItem),
);
stockRouter.post('/in', authorize('stock', 'edit'), asyncHandler(stockController.stockIn));
stockRouter.post('/out', authorize('stock', 'edit'), asyncHandler(stockController.stockOut));
stockRouter.get(
  '/history',
  authorize('stock', 'view'),
  asyncHandler(stockController.getStockHistory),
);
stockRouter.get(
  '/summary',
  authorize('stock', 'view'),
  asyncHandler(stockController.getStockSummary),
);
