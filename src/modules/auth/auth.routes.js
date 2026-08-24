import { Router } from 'express';

import { auth } from '../../middlewares/authenticate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as authController from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(authController.login));
authRouter.get('/me', auth(), asyncHandler(authController.getCurrentUser));
authRouter.post('/logout', asyncHandler(authController.logout));
