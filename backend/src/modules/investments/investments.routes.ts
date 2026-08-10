import { Router } from 'express';
import { db } from '../../config/database.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { settingsService } from '../settings/settings.routes.js';
import { InvestmentsController } from './investments.controller.js';
import {
  createEntrySchema,
  createInvestmentAccountSchema,
  projectionQuerySchema,
  quoteQuerySchema,
  updateInvestmentAccountSchema,
} from './investments.schema.js';
import { InvestmentsService } from './investments.service.js';
import { QuoteService } from './quote.service.js';

const investmentsService = new InvestmentsService(db);
export const quoteService = new QuoteService(db, settingsService);
const investmentsController = new InvestmentsController(investmentsService, quoteService);

export const investmentsRouter = Router();

investmentsRouter.use(requireAuth);
// '/milestones' and '/quote' must be registered before the '/:id' catch-all.
investmentsRouter.get('/milestones', investmentsController.getMilestones);
investmentsRouter.get('/quote', validate(quoteQuerySchema, 'query'), investmentsController.getQuote);
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
investmentsRouter.get('/:id/entries', investmentsController.listEntries);
investmentsRouter.get(
  '/:id/projection',
  validate(projectionQuerySchema, 'query'),
  investmentsController.getProjection,
);
