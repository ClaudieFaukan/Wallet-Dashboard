import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import type {
  CreateRealEstateAssetInput,
  RecordValueInput,
  UpdateRealEstateAssetInput,
} from './real-estate.schema.js';
import type { RealEstateService } from './real-estate.service.js';

export class RealEstateController {
  constructor(private readonly realEstateService: RealEstateService) {}

  list: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const assets = await this.realEstateService.list(user.id);
      res.json({ success: true, data: assets });
    } catch (err) {
      next(err);
    }
  };

  create: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const asset = await this.realEstateService.create(
        user.id,
        req.body as CreateRealEstateAssetInput,
      );
      res.status(201).json({ success: true, data: asset });
    } catch (err) {
      next(err);
    }
  };

  getById: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const asset = await this.realEstateService.getById(user.id, req.params.id as string);
      res.json({ success: true, data: asset });
    } catch (err) {
      next(err);
    }
  };

  update: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const asset = await this.realEstateService.update(
        user.id,
        req.params.id as string,
        req.body as UpdateRealEstateAssetInput,
      );
      res.json({ success: true, data: asset });
    } catch (err) {
      next(err);
    }
  };

  delete: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      await this.realEstateService.delete(user.id, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  recordValue: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const result = await this.realEstateService.recordValue(
        user.id,
        req.params.id as string,
        req.body as RecordValueInput,
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  history: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const history = await this.realEstateService.history(user.id, req.params.id as string);
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  };
}
