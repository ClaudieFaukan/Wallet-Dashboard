import { z } from 'zod';

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Invalid date' });

export const createInvestmentAccountSchema = z.object({
  name: z.string().min(1),
  platform: z.string().optional(),
  currentValue: z.number().int().default(0),
  currency: z.string().length(3).default('EUR'),
});
export type CreateInvestmentAccountInput = z.infer<typeof createInvestmentAccountSchema>;

export const updateInvestmentAccountSchema = createInvestmentAccountSchema.partial();
export type UpdateInvestmentAccountInput = z.infer<typeof updateInvestmentAccountSchema>;

export const createEntrySchema = z.object({
  date: isoDate,
  amountInvested: z.number().int(),
  portfolioValue: z.number().int(),
  entryType: z.enum(['contribution', 'dividend', 'fee']).default('contribution'),
  notes: z.string().optional(),
  ticker: z.string().optional(),
  assetType: z.enum(['stock', 'etf']).optional(),
  isin: z.string().trim().min(1).max(20).optional(),
  shares: z.number().positive().optional(),
});
export type CreateEntryInput = z.infer<typeof createEntrySchema>;

export const updateEntrySchema = createEntrySchema.partial();
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;

export const quoteQuerySchema = z.object({
  symbol: z.string().min(1),
});
export type QuoteQuery = z.infer<typeof quoteQuerySchema>;

export const createInvestmentGoalSchema = z.object({
  name: z.string().min(1),
  targetAmount: z.number().int().positive(),
  color: z.string().optional(),
});
export type CreateInvestmentGoalInput = z.infer<typeof createInvestmentGoalSchema>;

export const updateInvestmentGoalSchema = createInvestmentGoalSchema.partial();
export type UpdateInvestmentGoalInput = z.infer<typeof updateInvestmentGoalSchema>;

export const projectionQuerySchema = z.object({
  monthlyContribution: z.coerce.number().int().default(0),
  // Fraction, not a percentage (0.07 = 7%), matching base.md's "annual_rate (variable, défaut 7%)".
  annualRate: z.coerce.number().min(0).max(1).default(0.07),
  years: z.coerce.number().int().positive().max(50).default(10),
});
export type ProjectionQuery = z.infer<typeof projectionQuerySchema>;
