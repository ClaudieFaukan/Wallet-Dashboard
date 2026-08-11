import { Router } from 'express';
import { db } from '../../config/database.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { BudgetController } from './budget.controller.js';
import {
  createBudgetLineSchema,
  currentQuerySchema,
  updateBudgetLineSchema,
  yearParamSchema,
} from './budget.schema.js';
import { BudgetService } from './budget.service.js';

const budgetService = new BudgetService(db);
const budgetController = new BudgetController(budgetService);

export const budgetRouter = Router();

budgetRouter.use(requireAuth);
// Order matters: '/current' and '/lines' must be registered before the '/:year' catch-all.
budgetRouter.get('/current', validate(currentQuerySchema, 'query'), budgetController.getCurrent);
budgetRouter.post('/lines', validate(createBudgetLineSchema), budgetController.addLine);
budgetRouter.patch('/lines/:id', validate(updateBudgetLineSchema), budgetController.updateLine);
budgetRouter.delete('/lines/:id', budgetController.deleteLine);
budgetRouter.get('/:year', validate(yearParamSchema, 'params'), budgetController.getYearly);
