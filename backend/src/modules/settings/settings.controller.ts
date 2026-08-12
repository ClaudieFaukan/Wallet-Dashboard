import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import { AppError } from '../../shared/utils/AppError.js';
import type { SettingsService } from './settings.service.js';
import type { TestSettingInput, UpdateSettingsInput } from './settings.schema.js';

export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  getStatus: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const status = await this.settingsService.getStatus(user.id);
      res.json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  };

  update: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      await this.settingsService.update(user.id, req.body as UpdateSettingsInput);
      const status = await this.settingsService.getStatus(user.id);
      res.json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  };

  test: RequestHandler = async (req, res, next) => {
    try {
      const result = await this.settingsService.test(req.body as TestSettingInput);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  resetDevData: RequestHandler = async (req, res, next) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        throw new AppError(403, 'FORBIDDEN', 'Dev reset is disabled in production');
      }
      const { user } = req as AuthenticatedRequest;
      await this.settingsService.resetDevData(user.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
