import { Router } from 'express';
import { db } from '../../config/database.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { SavingsController } from './savings.controller.js';
import {
  createSavingsGoalSchema,
  depositSchema,
  updateDepositSchema,
  updateSavingsGoalSchema,
} from './savings.schema.js';
import { SavingsService } from './savings.service.js';

export const savingsService = new SavingsService(db);
const savingsController = new SavingsController(savingsService);

export const savingsRouter = Router();

savingsRouter.use(requireAuth);
savingsRouter.get('/', savingsController.list);
savingsRouter.post('/', validate(createSavingsGoalSchema), savingsController.create);
savingsRouter.get('/:id', savingsController.getById);
savingsRouter.patch('/:id', validate(updateSavingsGoalSchema), savingsController.update);
savingsRouter.delete('/:id', savingsController.delete);
savingsRouter.post('/:id/deposit', validate(depositSchema), savingsController.deposit);
savingsRouter.get('/:id/deposits', savingsController.listDeposits);
savingsRouter.patch(
  '/:id/deposits/:depositId',
  validate(updateDepositSchema),
  savingsController.updateDeposit,
);
savingsRouter.delete('/:id/deposits/:depositId', savingsController.deleteDeposit);
savingsRouter.get('/:id/milestones', savingsController.getMilestones);
