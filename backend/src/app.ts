import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { accountsRouter } from './modules/accounts/accounts.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { budgetRouter } from './modules/budget/budget.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { cryptoRouter } from './modules/crypto/crypto.routes.js';
import { investmentsRouter } from './modules/investments/investments.routes.js';
import { savingsRouter } from './modules/savings/savings.routes.js';
import { transactionsRouter } from './modules/transactions/transactions.routes.js';
import { errorHandler } from './shared/middleware/errorHandler.middleware.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  // Electron loads the renderer from a custom scheme in production (not http://),
  // which changes cross-origin cookie behaviour — revisit sameSite/CORS at the Electron shell step.
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/v1/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok' } });
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/accounts', accountsRouter);
  app.use('/api/v1/budget', budgetRouter);
  app.use('/api/v1/categories', categoriesRouter);
  app.use('/api/v1/crypto', cryptoRouter);
  app.use('/api/v1/investments', investmentsRouter);
  app.use('/api/v1/savings', savingsRouter);
  app.use('/api/v1/transactions', transactionsRouter);

  app.use(errorHandler);

  return app;
}
