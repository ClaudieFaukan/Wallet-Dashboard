import { z } from 'zod';

export const createWalletSchema = z.object({
  name: z.string().min(1),
  platform: z.enum(['metamask', 'phantom', 'crypto_com', 'binance', 'bybit', 'coinbase', 'kraken']),
  address: z.string().min(1),
  chain: z.enum(['ethereum', 'solana']),
});
export type CreateWalletInput = z.infer<typeof createWalletSchema>;

export const updateWalletSchema = createWalletSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateWalletInput = z.infer<typeof updateWalletSchema>;
