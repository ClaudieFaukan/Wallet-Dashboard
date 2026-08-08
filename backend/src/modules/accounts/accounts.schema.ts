import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['checking', 'savings', 'investment']),
  institution: z.string().optional(),
  balance: z.number().int().default(0),
  currency: z.string().length(3).default('EUR'),
  color: z.string().optional(),
  icon: z.string().optional(),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = createAccountSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const balanceHistoryQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(3650).default(30),
});
export type BalanceHistoryQuery = z.infer<typeof balanceHistoryQuerySchema>;
