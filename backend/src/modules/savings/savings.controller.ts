import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import type {
  CreateSavingsGoalInput,
  DepositInput,
  UpdateSavingsGoalInput,
} from './savings.schema.js';
import type { SavingsService } from './savings.service.js';

export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  list: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const goals = await this.savingsService.list(user.id);
      res.json({ success: true, data: goals });
    } catch (err) {
      next(err);
    }
  };

  create: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const goal = await this.savingsService.create(user.id, req.body as CreateSavingsGoalInput);
      res.status(201).json({ success: true, data: goal });
    } catch (err) {
      next(err);
    }
  };

  getById: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const goal = await this.savingsService.getById(user.id, req.params.id as string);
      res.json({ success: true, data: goal });
    } catch (err) {
      next(err);
    }
  };

  update: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const goal = await this.savingsService.update(
        user.id,
        req.params.id as string,
        req.body as UpdateSavingsGoalInput,
      );
      res.json({ success: true, data: goal });
    } catch (err) {
      next(err);
    }
  };

  delete: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      await this.savingsService.delete(user.id, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  deposit: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const result = await this.savingsService.deposit(
        user.id,
        req.params.id as string,
        (req.body as DepositInput).amount,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  listDeposits: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const deposits = await this.savingsService.listDeposits(user.id, req.params.id as string);
      res.json({ success: true, data: deposits });
    } catch (err) {
      next(err);
    }
  };
}
