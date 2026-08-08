import { Router } from 'express';
import { db } from '../../config/database.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { TransactionsController } from './transactions.controller.js';
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  statsQuerySchema,
  updateTransactionSchema,
} from './transactions.schema.js';
import { TransactionsService } from './transactions.service.js';

const transactionsService = new TransactionsService(db);
const transactionsController = new TransactionsController(transactionsService);

export const transactionsRouter = Router();

transactionsRouter.use(requireAuth);
transactionsRouter.get('/stats', validate(statsQuerySchema, 'query'), transactionsController.stats);
transactionsRouter.get(
  '/',
  validate(listTransactionsQuerySchema, 'query'),
  transactionsController.list,
);
transactionsRouter.post('/', validate(createTransactionSchema), transactionsController.create);
transactionsRouter.get('/:id', transactionsController.getById);
transactionsRouter.patch('/:id', validate(updateTransactionSchema), transactionsController.update);
transactionsRouter.delete('/:id', transactionsController.delete);
