import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import type {
  CreateCreditInput,
  RecordPaymentInput,
  SimulationQuery,
  UpdateCreditInput,
} from './credits.schema.js';
import type { CreditsService } from './credits.service.js';

export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  list: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const credits = await this.creditsService.list(user.id);
      res.json({ success: true, data: credits });
    } catch (err) {
      next(err);
    }
  };

  create: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const credit = await this.creditsService.create(user.id, req.body as CreateCreditInput);
      res.status(201).json({ success: true, data: credit });
    } catch (err) {
      next(err);
    }
  };

  getById: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const credit = await this.creditsService.getById(user.id, req.params.id as string);
      res.json({ success: true, data: credit });
    } catch (err) {
      next(err);
    }
  };

  update: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const credit = await this.creditsService.update(
        user.id,
        req.params.id as string,
        req.body as UpdateCreditInput,
      );
      res.json({ success: true, data: credit });
    } catch (err) {
      next(err);
    }
  };

  delete: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      await this.creditsService.delete(user.id, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  recordPayment: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const result = await this.creditsService.recordPayment(
        user.id,
        req.params.id as string,
        req.body as RecordPaymentInput,
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  listPayments: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const payments = await this.creditsService.listPayments(user.id, req.params.id as string);
      res.json({ success: true, data: payments });
    } catch (err) {
      next(err);
    }
  };

  getSimulation: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const params = req.query as unknown as SimulationQuery;
      const simulation = await this.creditsService.getSimulation(
        user.id,
        req.params.id as string,
        params,
      );
      res.json({ success: true, data: simulation });
    } catch (err) {
      next(err);
    }
  };
}
