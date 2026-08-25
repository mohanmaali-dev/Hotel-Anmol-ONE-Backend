import { Router } from 'express';

import * as dependencyController from '../controllers/dependency.controller.js';
import { auth } from '../middlewares/authenticate.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const moduleByType = {
  order: 'orders',
  purchase: 'purchases',
  supplier: 'suppliers',
  'stock-item': 'stock',
  'stock-category': 'stock',
  'menu-item': 'menu',
  'menu-category': 'menu',
  expense: 'expenses',
  user: 'users',
};

const authorizeDependencyCheck = (request, response, next) => {
  const module = moduleByType[request.params.type];
  if (!module) {
    const error = new Error('Unsupported record type');
    error.statusCode = 400;
    return next(error);
  }
  return authorize(module, 'delete')(request, response, next);
};

export const dependencyRouter = Router();

dependencyRouter.use(auth());
dependencyRouter.get(
  '/:type/:id',
  authorizeDependencyCheck,
  asyncHandler(dependencyController.getDependencies),
);
