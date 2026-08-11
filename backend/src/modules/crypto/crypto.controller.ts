import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import type {
  CreateCostEntryInput,
  CreateWalletInput,
  UpdateCostEntryInput,
  UpdateWalletInput,
} from './crypto.schema.js';
import type { CryptoService } from './crypto.service.js';

export class CryptoController {
  constructor(private readonly cryptoService: CryptoService) {}

  list: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const wallets = await this.cryptoService.list(user.id);
      res.json({ success: true, data: wallets });
    } catch (err) {
      next(err);
    }
  };

  create: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const wallet = await this.cryptoService.create(user.id, req.body as CreateWalletInput);
      res.status(201).json({ success: true, data: wallet });
    } catch (err) {
      next(err);
    }
  };

  getById: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const wallet = await this.cryptoService.getById(user.id, req.params.id as string);
      res.json({ success: true, data: wallet });
    } catch (err) {
      next(err);
    }
  };

  update: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const wallet = await this.cryptoService.update(
        user.id,
        req.params.id as string,
        req.body as UpdateWalletInput,
      );
      res.json({ success: true, data: wallet });
    } catch (err) {
      next(err);
    }
  };

  delete: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      await this.cryptoService.delete(user.id, req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  sync: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const snapshot = await this.cryptoService.sync(user.id, req.params.id as string);
      res.json({ success: true, data: snapshot });
    } catch (err) {
      next(err);
    }
  };

  history: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const snapshots = await this.cryptoService.history(user.id, req.params.id as string);
      res.json({ success: true, data: snapshots });
    } catch (err) {
      next(err);
    }
  };

  tokens: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const tokens = await this.cryptoService.getTokens(user.id, req.params.id as string);
      res.json({ success: true, data: tokens });
    } catch (err) {
      next(err);
    }
  };

  listCostEntries: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const entries = await this.cryptoService.listCostEntries(user.id, req.params.id as string);
      res.json({ success: true, data: entries });
    } catch (err) {
      next(err);
    }
  };

  addCostEntry: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const entry = await this.cryptoService.addCostEntry(
        user.id,
        req.params.id as string,
        req.body as CreateCostEntryInput,
      );
      res.status(201).json({ success: true, data: entry });
    } catch (err) {
      next(err);
    }
  };

  updateCostEntry: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const entry = await this.cryptoService.updateCostEntry(
        user.id,
        req.params.id as string,
        req.params.entryId as string,
        req.body as UpdateCostEntryInput,
      );
      res.json({ success: true, data: entry });
    } catch (err) {
      next(err);
    }
  };

  deleteCostEntry: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      await this.cryptoService.deleteCostEntry(
        user.id,
        req.params.id as string,
        req.params.entryId as string,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
