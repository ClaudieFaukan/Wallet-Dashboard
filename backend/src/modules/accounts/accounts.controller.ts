import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import { AppError } from '../../shared/utils/AppError.js';
import type {
  BalanceHistoryQuery,
  CreateAccountInput,
  UpdateAccountInput,
} from './accounts.schema.js';
import type { AccountsService } from './accounts.service.js';

export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  list: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const accounts = await this.accountsService.list(user.id);
      res.json({ success: true, data: accounts });
    } catch (err) {
      next(err);
    }
  };

  create: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const account = await this.accountsService.create(user.id, req.body as CreateAccountInput);
      res.status(201).json({ success: true, data: account });
    } catch (err) {
      next(err);
    }
  };

  getById: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const account = await this.accountsService.getById(user.id, req.params.id as string);
      res.json({ success: true, data: account });
    } catch (err) {
      next(err);
    }
  };

  update: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const account = await this.accountsService.update(
        user.id,
        req.params.id as string,
        req.body as UpdateAccountInput,
      );
      res.json({ success: true, data: account });
    } catch (err) {
      next(err);
    }
  };

  delete: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      await this.accountsService.delete(user.id, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  balanceHistory: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const { days } = req.query as unknown as BalanceHistoryQuery;
      const history = await this.accountsService.balanceHistory(
        user.id,
        req.params.id as string,
        days,
      );
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  };

  importCsv: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      if (!req.file) throw new AppError(400, 'MISSING_FILE', 'No CSV file uploaded');
      const result = await this.accountsService.importCsv(
        user.id,
        req.params.id as string,
        req.file.buffer.toString('utf8'),
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  syncRevolut: RequestHandler = async (req, _res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      await this.accountsService.syncRevolut(user.id, req.params.id as string);
    } catch (err) {
      next(err);
    }
  };
}
