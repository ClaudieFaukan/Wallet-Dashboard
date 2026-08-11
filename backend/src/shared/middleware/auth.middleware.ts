import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';
import { env } from '../../config/env.js';

export interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; isDemo: boolean };
}

interface AccessTokenPayload {
  sub: string;
  email: string;
  isDemo: boolean;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// The demo account is otherwise fully editable (reseeded fresh on every login — see
// AuthService.login) so visitors can actually try the product, not just look at it.
// Only third-party API keys/integrations stay locked down, since those are real
// secrets read from this machine's env/DB, not demo data.
const DEMO_BLOCKED_PREFIXES = ['/api/v1/settings'];

export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    next(new AppError(401, 'UNAUTHORIZED', 'Missing access token'));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    const isBlockedForDemo =
      payload.isDemo &&
      !SAFE_METHODS.has(req.method) &&
      DEMO_BLOCKED_PREFIXES.some((prefix) => req.baseUrl.startsWith(prefix));
    if (isBlockedForDemo) {
      next(new AppError(403, 'DEMO_READ_ONLY', 'Mode démo — réglages non modifiables (clés API, intégrations)'));
      return;
    }
    (req as AuthenticatedRequest).user = { id: payload.sub, email: payload.email, isDemo: payload.isDemo };
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired access token'));
  }
};
