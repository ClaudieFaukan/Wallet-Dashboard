import { Router } from 'express';
import { db } from '../../config/database.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { SettingsController } from './settings.controller.js';
import { testSettingSchema, updateSettingsSchema } from './settings.schema.js';
import { SettingsService } from './settings.service.js';

export const settingsService = new SettingsService(db);
const settingsController = new SettingsController(settingsService);

export const settingsRouter = Router();

settingsRouter.use(requireAuth);
settingsRouter.get('/', settingsController.getStatus);
settingsRouter.put('/', validate(updateSettingsSchema), settingsController.update);
settingsRouter.post('/test', validate(testSettingSchema), settingsController.test);
