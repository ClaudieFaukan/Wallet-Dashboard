import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/AppError.js';

type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodType, target: ValidationTarget = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      next(new AppError(400, 'VALIDATION_ERROR', 'Invalid request data', result.error.issues));
      return;
    }
    // Express 5 exposes req.query as a getter-only property, so a plain
    // assignment throws — redefine it instead (works for body/params too).
    Object.defineProperty(req, target, { value: result.data, configurable: true, writable: true });
    next();
  };
}
