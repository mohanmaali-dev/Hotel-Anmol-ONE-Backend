import { Router } from 'express';

import * as settingController from '../controllers/setting.controller.js';
import { auth } from '../middlewares/authenticate.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

export const settingRouter = Router();

settingRouter.use(auth());
settingRouter.get('/public', asyncHandler(settingController.getPublicSettings));
settingRouter.get('/', authorize('settings', 'view'), asyncHandler(settingController.getSettings));
settingRouter.put(
  '/',
  authorize('settings', 'edit'),
  asyncHandler(settingController.updateSettings),
);
