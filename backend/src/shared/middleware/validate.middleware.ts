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
    req[target] = result.data;
    next();
  };
}
