import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import type {
  CreateTransactionInput,
  ListTransactionsQuery,
  StatsQuery,
  UpdateTransactionInput,
} from './transactions.schema.js';
import type { TransactionsService } from './transactions.service.js';

export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  create: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const transaction = await this.transactionsService.create(
        user.id,
        req.body as CreateTransactionInput,
      );
      res.status(201).json({ success: true, data: transaction });
    } catch (err) {
      next(err);
    }
  };

  list: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const query = req.query as unknown as ListTransactionsQuery;
      const { items, nextCursor, hasMore } = await this.transactionsService.list(user.id, query);
      res.json({ success: true, data: items, meta: { nextCursor, hasMore } });
    } catch (err) {
      next(err);
    }
  };

  getById: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const transaction = await this.transactionsService.getById(user.id, req.params.id as string);
      res.json({ success: true, data: transaction });
    } catch (err) {
      next(err);
    }
  };

  update: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const transaction = await this.transactionsService.update(
        user.id,
        req.params.id as string,
        req.body as UpdateTransactionInput,
      );
      res.json({ success: true, data: transaction });
    } catch (err) {
      next(err);
    }
  };

  delete: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      await this.transactionsService.delete(user.id, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  stats: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const stats = await this.transactionsService.stats(
        user.id,
        req.query as unknown as StatsQuery,
      );
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  };
}
