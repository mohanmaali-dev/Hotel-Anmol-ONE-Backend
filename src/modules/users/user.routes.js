import { Router } from 'express';

import { auth } from '../../middlewares/authenticate.middleware.js';
import { authorize } from '../../middlewares/authorize.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as userController from './user.controller.js';

export const userRouter = Router();

const adminOnly = (request, _response, next) => {
  if (request.user?.role !== 'Admin') {
    const error = new Error('Only an Admin can manage user accounts');
    error.statusCode = 403;
    return next(error);
  }
  return next();
};

userRouter.use(auth());
userRouter.get('/', authorize('users', 'view'), asyncHandler(userController.getUsers));
userRouter.post(
  '/',
  authorize('users', 'create'),
  adminOnly,
  asyncHandler(userController.createUser),
);
userRouter.get('/:id', authorize('users', 'view'), asyncHandler(userController.getUser));
userRouter.patch(
  '/:id',
  authorize('users', 'edit'),
  adminOnly,
  asyncHandler(userController.updateUser),
);
userRouter.delete(
  '/:id',
  authorize('users', 'delete'),
  adminOnly,
  asyncHandler(userController.deleteUser),
);
