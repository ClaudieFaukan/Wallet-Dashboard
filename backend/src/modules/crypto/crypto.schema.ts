import { z } from 'zod';

export const createWalletSchema = z.object({
  name: z.string().min(1),
  platform: z.enum([
    'metamask',
    'phantom',
    'crypto_com',
    'binance',
    'bybit',
    'coinbase',
    'kraken',
    'meria',
  ]),
  address: z.string().min(1),
  chain: z.enum(['ethereum', 'solana']),
});
export type CreateWalletInput = z.infer<typeof createWalletSchema>;

export const updateWalletSchema = createWalletSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateWalletInput = z.infer<typeof updateWalletSchema>;

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Invalid date' });

export const createCostEntrySchema = z.object({
  symbol: z.string().min(1),
  amountInvestedCents: z.number().int().positive(),
  purchasedAt: isoDate,
  notes: z.string().optional(),
});
export type CreateCostEntryInput = z.infer<typeof createCostEntrySchema>;

export const updateCostEntrySchema = createCostEntrySchema.partial();
export type UpdateCostEntryInput = z.infer<typeof updateCostEntrySchema>;
