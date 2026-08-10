import { Router } from 'express';
import { db } from '../../config/database.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { RealEstateController } from './real-estate.controller.js';
import {
  createRealEstateAssetSchema,
  recordValueSchema,
  updateRealEstateAssetSchema,
} from './real-estate.schema.js';
import { RealEstateService } from './real-estate.service.js';

const realEstateService = new RealEstateService(db);
const realEstateController = new RealEstateController(realEstateService);

export const realEstateRouter = Router();

realEstateRouter.use(requireAuth);
realEstateRouter.get('/', realEstateController.list);
realEstateRouter.post('/', validate(createRealEstateAssetSchema), realEstateController.create);
realEstateRouter.get('/:id', realEstateController.getById);
realEstateRouter.patch(
  '/:id',
  validate(updateRealEstateAssetSchema),
  realEstateController.update,
);
realEstateRouter.delete('/:id', realEstateController.delete);
realEstateRouter.post('/:id/value', validate(recordValueSchema), realEstateController.recordValue);
realEstateRouter.get('/:id/history', realEstateController.history);
