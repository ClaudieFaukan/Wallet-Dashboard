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

export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    next(new AppError(401, 'UNAUTHORIZED', 'Missing access token'));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    // FEAT-09 (docs/feat1.md): the seeded demo account is read-only — blocking mutations
    // here, centrally, covers every protected router without touching each one individually.
    if (payload.isDemo && !SAFE_METHODS.has(req.method)) {
      next(new AppError(403, 'DEMO_READ_ONLY', 'Mode démo — compte en lecture seule'));
      return;
    }
    (req as AuthenticatedRequest).user = { id: payload.sub, email: payload.email, isDemo: payload.isDemo };
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired access token'));
  }
};
