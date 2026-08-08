import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { authRouter } from './modules/auth/auth.routes.js';
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

  app.use(errorHandler);

  return app;
}
