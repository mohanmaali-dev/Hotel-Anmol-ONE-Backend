import { Router } from 'express';

import * as expenseController from '../controllers/expense.controller.js';
import { auth } from '../middlewares/authenticate.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

export const expenseRouter = Router();

expenseRouter.use(auth());
expenseRouter.get(
  '/summary',
  authorize('expenses', 'view'),
  asyncHandler(expenseController.getExpenseSummary),
);
expenseRouter.get('/', authorize('expenses', 'view'), asyncHandler(expenseController.getExpenses));
expenseRouter.get(
  '/:id',
  authorize('expenses', 'view'),
  asyncHandler(expenseController.getExpense),
);
expenseRouter.post(
  '/',
  authorize('expenses', 'create'),
  asyncHandler(expenseController.createExpense),
);
expenseRouter.put(
  '/:id',
  authorize('expenses', 'edit'),
  asyncHandler(expenseController.updateExpense),
);
expenseRouter.delete(
  '/:id',
  authorize('expenses', 'delete'),
  asyncHandler(expenseController.deleteExpense),
);
