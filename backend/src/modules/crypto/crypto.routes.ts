import { Router } from 'express';
import { db } from '../../config/database.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { settingsService } from '../settings/settings.routes.js';
import { CryptoController } from './crypto.controller.js';
import { createWalletSchema, updateWalletSchema } from './crypto.schema.js';
import { CryptoService } from './crypto.service.js';

const cryptoService = new CryptoService(db, settingsService);
const cryptoController = new CryptoController(cryptoService);

export const cryptoRouter = Router();

cryptoRouter.use(requireAuth);
cryptoRouter.get('/wallets', cryptoController.list);
cryptoRouter.post('/wallets', validate(createWalletSchema), cryptoController.create);
cryptoRouter.get('/wallets/:id', cryptoController.getById);
cryptoRouter.patch('/wallets/:id', validate(updateWalletSchema), cryptoController.update);
cryptoRouter.delete('/wallets/:id', cryptoController.delete);
cryptoRouter.post('/wallets/:id/sync', cryptoController.sync);
cryptoRouter.get('/wallets/:id/history', cryptoController.history);
cryptoRouter.get('/wallets/:id/tokens', cryptoController.tokens);
