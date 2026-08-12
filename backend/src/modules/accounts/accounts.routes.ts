import { Router } from 'express';
import multer from 'multer';
import { db } from '../../config/database.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { investmentsService } from '../investments/investments.routes.js';
import { savingsService } from '../savings/savings.routes.js';
import { settingsService } from '../settings/settings.routes.js';
import { AccountsController } from './accounts.controller.js';
import {
  balanceHistoryQuerySchema,
  createAccountSchema,
  updateAccountSchema,
} from './accounts.schema.js';
import { AccountsService } from './accounts.service.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const accountsService = new AccountsService(db, settingsService, savingsService, investmentsService);
const accountsController = new AccountsController(accountsService);

export const accountsRouter = Router();

accountsRouter.use(requireAuth);
accountsRouter.get('/', accountsController.list);
accountsRouter.post('/', validate(createAccountSchema), accountsController.create);
accountsRouter.post(
  '/import/pdf/preview',
  upload.single('file'),
  accountsController.previewPdfImport,
);
accountsRouter.post(
  '/import/pdf/confirm',
  upload.single('file'),
  accountsController.confirmPdfImport,
);
accountsRouter.get('/:id', accountsController.getById);
accountsRouter.patch('/:id', validate(updateAccountSchema), accountsController.update);
accountsRouter.delete('/:id', accountsController.delete);
accountsRouter.get(
  '/:id/balance-history',
  validate(balanceHistoryQuerySchema, 'query'),
  accountsController.balanceHistory,
);
accountsRouter.post('/:id/sync/revolut', accountsController.syncRevolut);
accountsRouter.post('/:id/import/csv', upload.single('file'), accountsController.importCsv);
