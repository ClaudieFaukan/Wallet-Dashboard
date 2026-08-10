import type { RequestHandler } from 'express';
import type { ExchangeRatesService } from './exchange-rates.service.js';

export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  getLatest: RequestHandler = async (_req, res, next) => {
    try {
      const rates = await this.exchangeRatesService.getLatest();
      res.json({ success: true, data: rates });
    } catch (err) {
      next(err);
    }
  };
}
