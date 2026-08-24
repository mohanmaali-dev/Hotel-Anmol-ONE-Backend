import { Router } from 'express';

import * as menuController from '../controllers/menu.controller.js';
import { auth } from '../middlewares/authenticate.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

export const menuRouter = Router();

menuRouter.use(auth());
menuRouter.get(
  '/categories',
  authorize('menu', 'view'),
  asyncHandler(menuController.getCategories),
);
menuRouter.post(
  '/categories',
  authorize('menu', 'create'),
  asyncHandler(menuController.createCategory),
);
menuRouter.put(
  '/categories/:id',
  authorize('menu', 'edit'),
  asyncHandler(menuController.updateCategory),
);
menuRouter.delete(
  '/categories/:id',
  authorize('menu', 'delete'),
  asyncHandler(menuController.deleteCategory),
);

menuRouter.get('/items', authorize('menu', 'view'), asyncHandler(menuController.getMenuItems));
menuRouter.get('/items/:id', authorize('menu', 'view'), asyncHandler(menuController.getMenuItem));
menuRouter.post('/items', authorize('menu', 'create'), asyncHandler(menuController.createMenuItem));
menuRouter.put(
  '/items/:id',
  authorize('menu', 'edit'),
  asyncHandler(menuController.updateMenuItem),
);
menuRouter.delete(
  '/items/:id',
  authorize('menu', 'delete'),
  asyncHandler(menuController.deleteMenuItem),
);
