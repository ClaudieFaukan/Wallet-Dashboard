import { Router } from 'express';
import { db } from '../../config/database.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { CollectiblesController } from './collectibles.controller.js';
import {
  createCollectibleSchema,
  listCollectiblesQuerySchema,
  manualPriceUpdateSchema,
  performanceQuerySchema,
  searchCardQuerySchema,
  updateCollectibleSchema,
} from './collectibles.schema.js';
import { CollectiblesService } from './collectibles.service.js';

const collectiblesService = new CollectiblesService(db);
const collectiblesController = new CollectiblesController(collectiblesService);

export const collectiblesRouter = Router();

collectiblesRouter.use(requireAuth);
// Static routes must be registered before the '/:id' catch-all.
collectiblesRouter.post('/sync-prices', collectiblesController.syncPrices);
collectiblesRouter.get(
  '/performance',
  validate(performanceQuerySchema, 'query'),
  collectiblesController.performance,
);
collectiblesRouter.get(
  '/search/card',
  validate(searchCardQuerySchema, 'query'),
  collectiblesController.searchCard,
);
collectiblesRouter.get(
  '/',
  validate(listCollectiblesQuerySchema, 'query'),
  collectiblesController.list,
);
collectiblesRouter.post('/', validate(createCollectibleSchema), collectiblesController.create);
collectiblesRouter.get('/:id', collectiblesController.getById);
collectiblesRouter.put('/:id', validate(updateCollectibleSchema), collectiblesController.update);
collectiblesRouter.delete('/:id', collectiblesController.delete);
collectiblesRouter.put(
  '/:id/price',
  validate(manualPriceUpdateSchema),
  collectiblesController.updatePrice,
);
