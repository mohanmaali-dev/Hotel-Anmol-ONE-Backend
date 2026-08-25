import { Router } from 'express';

import * as searchController from '../controllers/search.controller.js';
import { auth } from '../middlewares/authenticate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

export const searchRouter = Router();

searchRouter.use(auth());
searchRouter.get('/', asyncHandler(searchController.search));
