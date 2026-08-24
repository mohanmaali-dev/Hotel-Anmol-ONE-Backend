import { Router } from 'express';

import * as orderController from '../controllers/order.controller.js';
import { auth } from '../middlewares/authenticate.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

export const orderRouter = Router();

orderRouter.use(auth());
orderRouter.get('/', authorize('orders', 'view'), asyncHandler(orderController.getOrders));
orderRouter.get('/:id', authorize('orders', 'view'), asyncHandler(orderController.getOrder));
orderRouter.post('/', authorize('orders', 'create'), asyncHandler(orderController.createOrder));
orderRouter.put('/:id', authorize('orders', 'edit'), asyncHandler(orderController.updateOrder));
orderRouter.delete(
  '/:id',
  authorize('orders', 'delete'),
  asyncHandler(orderController.deleteOrder),
);
