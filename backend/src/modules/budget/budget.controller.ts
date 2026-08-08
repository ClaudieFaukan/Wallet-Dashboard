import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import type { CreateBudgetLineInput, UpdateBudgetLineInput, YearParam } from './budget.schema.js';
import type { BudgetService } from './budget.service.js';

export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  getCurrent: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const budget = await this.budgetService.getCurrent(user.id);
      res.json({ success: true, data: budget });
    } catch (err) {
      next(err);
    }
  };

  getYearly: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const { year } = req.params as unknown as YearParam;
      const months = await this.budgetService.getYearly(user.id, year);
      res.json({ success: true, data: months });
    } catch (err) {
      next(err);
    }
  };

  addLine: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const line = await this.budgetService.addLine(user.id, req.body as CreateBudgetLineInput);
      res.status(201).json({ success: true, data: line });
    } catch (err) {
      next(err);
    }
  };

  updateLine: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const line = await this.budgetService.updateLine(
        user.id,
        req.params.id as string,
        req.body as UpdateBudgetLineInput,
      );
      res.json({ success: true, data: line });
    } catch (err) {
      next(err);
    }
  };
}
