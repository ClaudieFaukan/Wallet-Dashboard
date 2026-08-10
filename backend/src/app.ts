import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { accountsRouter } from './modules/accounts/accounts.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { budgetRouter } from './modules/budget/budget.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { collectiblesRouter } from './modules/collectibles/collectibles.routes.js';
import { creditsRouter } from './modules/credits/credits.routes.js';
import { cryptoRouter } from './modules/crypto/crypto.routes.js';
import { exchangeRatesRouter } from './modules/exchange-rates/exchange-rates.routes.js';
import { investmentsRouter } from './modules/investments/investments.routes.js';
import { realEstateRouter } from './modules/real-estate/real-estate.routes.js';
import { savingsRouter } from './modules/savings/savings.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
import { transactionsRouter } from './modules/transactions/transactions.routes.js';
import { errorHandler } from './shared/middleware/errorHandler.middleware.js';

export function createApp() {
  const app = express();

  // CSP is enforced by the Electron shell itself (session.webRequest.onHeadersReceived,
  // see electron/src/main.ts) — disabled here to avoid two conflicting
  // Content-Security-Policy headers on the same response.
  app.use(helmet({ contentSecurityPolicy: false }));
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
  app.use('/api/v1/collectibles', collectiblesRouter);
  app.use('/api/v1/credits', creditsRouter);
  app.use('/api/v1/crypto', cryptoRouter);
  app.use('/api/v1/exchange-rates', exchangeRatesRouter);
  app.use('/api/v1/investments', investmentsRouter);
  app.use('/api/v1/real-estate', realEstateRouter);
  app.use('/api/v1/savings', savingsRouter);
  app.use('/api/v1/settings', settingsRouter);
  app.use('/api/v1/transactions', transactionsRouter);

  // Production only: the Electron shell loads http://localhost:<PORT> directly
  // instead of file://, so the frontend build is served same-origin as the API
  // — that's what keeps the sameSite:'strict' refresh cookie working in prod,
  // exactly like the two localhost ports already do in dev. Path holds whether
  // running from backend/dist/app.js in a local build or from the packaged
  // Resources/backend/dist/app.js (frontend/dist is always a sibling of backend/).
  if (env.NODE_ENV === 'production') {
    // express.static serves index.html for GET / by default — sufficient for
    // a HashRouter SPA, no catch-all route needed.
    app.use(express.static(path.join(import.meta.dirname, '../../frontend/dist')));
  }

  app.use(errorHandler);

  return app;
}
