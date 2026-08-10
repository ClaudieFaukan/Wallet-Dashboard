import { Router } from 'express';
import { db } from '../../config/database.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { ExchangeRatesController } from './exchange-rates.controller.js';
import { ExchangeRatesService } from './exchange-rates.service.js';

export const exchangeRatesService = new ExchangeRatesService(db);
const exchangeRatesController = new ExchangeRatesController(exchangeRatesService);

export const exchangeRatesRouter = Router();

exchangeRatesRouter.use(requireAuth);
exchangeRatesRouter.get('/latest', exchangeRatesController.getLatest);
