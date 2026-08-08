import { Router } from 'express';
import { db } from '../../config/database.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { InvestmentsController } from './investments.controller.js';
import {
  createEntrySchema,
  createInvestmentAccountSchema,
  projectionQuerySchema,
  updateInvestmentAccountSchema,
} from './investments.schema.js';
import { InvestmentsService } from './investments.service.js';

const investmentsService = new InvestmentsService(db);
const investmentsController = new InvestmentsController(investmentsService);

export const investmentsRouter = Router();

investmentsRouter.use(requireAuth);
// '/milestones' must be registered before the '/:id' catch-all.
investmentsRouter.get('/milestones', investmentsController.getMilestones);
investmentsRouter.get('/', investmentsController.list);
investmentsRouter.post('/', validate(createInvestmentAccountSchema), investmentsController.create);
investmentsRouter.get('/:id', investmentsController.getById);
investmentsRouter.patch(
  '/:id',
  validate(updateInvestmentAccountSchema),
  investmentsController.update,
);
investmentsRouter.delete('/:id', investmentsController.delete);
investmentsRouter.post('/:id/entry', validate(createEntrySchema), investmentsController.addEntry);
investmentsRouter.get(
  '/:id/projection',
  validate(projectionQuerySchema, 'query'),
  investmentsController.getProjection,
);
