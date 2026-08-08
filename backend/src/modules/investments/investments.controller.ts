import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import type {
  CreateEntryInput,
  CreateInvestmentAccountInput,
  ProjectionQuery,
  UpdateInvestmentAccountInput,
} from './investments.schema.js';
import type { InvestmentsService } from './investments.service.js';

export class InvestmentsController {
  constructor(private readonly investmentsService: InvestmentsService) {}

  list: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const accounts = await this.investmentsService.list(user.id);
      res.json({ success: true, data: accounts });
    } catch (err) {
      next(err);
    }
  };

  create: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const account = await this.investmentsService.create(
        user.id,
        req.body as CreateInvestmentAccountInput,
      );
      res.status(201).json({ success: true, data: account });
    } catch (err) {
      next(err);
    }
  };

  getById: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const account = await this.investmentsService.getById(user.id, req.params.id as string);
      res.json({ success: true, data: account });
    } catch (err) {
      next(err);
    }
  };

  update: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const account = await this.investmentsService.update(
        user.id,
        req.params.id as string,
        req.body as UpdateInvestmentAccountInput,
      );
      res.json({ success: true, data: account });
    } catch (err) {
      next(err);
    }
  };

  delete: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      await this.investmentsService.delete(user.id, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  addEntry: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const result = await this.investmentsService.addEntry(
        user.id,
        req.params.id as string,
        req.body as CreateEntryInput,
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  getProjection: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const params = req.query as unknown as ProjectionQuery;
      const projection = await this.investmentsService.getProjection(
        user.id,
        req.params.id as string,
        params,
      );
      res.json({ success: true, data: projection });
    } catch (err) {
      next(err);
    }
  };

  getMilestones: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const milestones = await this.investmentsService.getMilestones(user.id);
      res.json({ success: true, data: milestones });
    } catch (err) {
      next(err);
    }
  };
}
