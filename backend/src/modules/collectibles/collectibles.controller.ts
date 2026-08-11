import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import type {
  CreateCollectibleInput,
  ListCollectiblesQuery,
  ManualPriceUpdateInput,
  PerformanceQuery,
  SearchCardQuery,
  UpdateCollectibleInput,
} from './collectibles.schema.js';
import type { CollectiblesService } from './collectibles.service.js';

export class CollectiblesController {
  constructor(private readonly collectiblesService: CollectiblesService) {}

  getConfig: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const config = await this.collectiblesService.getConfig(user.id);
      res.json({ success: true, data: config });
    } catch (err) {
      next(err);
    }
  };

  list: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const { type } = req.query as unknown as ListCollectiblesQuery;
      const items = await this.collectiblesService.list(user.id, type);
      res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  };

  create: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const item = await this.collectiblesService.create(
        user.id,
        req.body as CreateCollectibleInput,
      );
      res.status(201).json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  };

  getById: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const result = await this.collectiblesService.getWithHistory(
        user.id,
        req.params.id as string,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  update: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const item = await this.collectiblesService.update(
        user.id,
        req.params.id as string,
        req.body as UpdateCollectibleInput,
      );
      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  };

  delete: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      await this.collectiblesService.delete(user.id, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  updatePrice: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const snapshot = await this.collectiblesService.updateManualPrice(
        user.id,
        req.params.id as string,
        req.body as ManualPriceUpdateInput,
      );
      res.json({ success: true, data: snapshot });
    } catch (err) {
      next(err);
    }
  };

  updatePriceSnapshot: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const snapshot = await this.collectiblesService.updatePriceSnapshot(
        user.id,
        req.params.id as string,
        req.params.snapshotId as string,
        req.body as ManualPriceUpdateInput,
      );
      res.json({ success: true, data: snapshot });
    } catch (err) {
      next(err);
    }
  };

  deletePriceSnapshot: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      await this.collectiblesService.deletePriceSnapshot(
        user.id,
        req.params.id as string,
        req.params.snapshotId as string,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  getImage: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const { contentType, buffer } = await this.collectiblesService.getImage(
        user.id,
        req.params.id as string,
      );
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.setHeader('Content-Type', contentType);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  };

  syncPrices: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const result = await this.collectiblesService.syncPrices(user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  performance: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const query = req.query as unknown as PerformanceQuery;
      const result = await this.collectiblesService.performance(user.id, query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  searchCard: RequestHandler = async (req, res, next) => {
    try {
      const { q, tcgType } = req.query as unknown as SearchCardQuery;
      console.log(`[collectibles] searchCard request q="${q}" tcgType="${tcgType}"`);
      const results = await this.collectiblesService.searchCard(q, tcgType);
      console.log(`[collectibles] searchCard response for q="${q}": ${results.length} result(s)`);
      res.json({ success: true, data: results });
    } catch (err) {
      next(err);
    }
  };
}
