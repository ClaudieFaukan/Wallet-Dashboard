import { Router } from 'express';
import { db } from '../../config/database.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { CreditsController } from './credits.controller.js';
import {
  createCreditSchema,
  recordPaymentSchema,
  simulationQuerySchema,
  updateCreditSchema,
} from './credits.schema.js';
import { CreditsService } from './credits.service.js';

const creditsService = new CreditsService(db);
const creditsController = new CreditsController(creditsService);

export const creditsRouter = Router();

creditsRouter.use(requireAuth);
creditsRouter.get('/', creditsController.list);
creditsRouter.post('/', validate(createCreditSchema), creditsController.create);
creditsRouter.get('/:id', creditsController.getById);
creditsRouter.patch('/:id', validate(updateCreditSchema), creditsController.update);
creditsRouter.delete('/:id', creditsController.delete);
creditsRouter.post('/:id/payments', validate(recordPaymentSchema), creditsController.recordPayment);
creditsRouter.get('/:id/payments', creditsController.listPayments);
creditsRouter.get(
  '/:id/simulation',
  validate(simulationQuerySchema, 'query'),
  creditsController.getSimulation,
);
