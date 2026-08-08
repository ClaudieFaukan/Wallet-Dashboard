import { z } from 'zod';

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Invalid date' });

export const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number().int(),
  currency: z.string().length(3).default('EUR'),
  type: z.enum(['income', 'expense', 'transfer']),
  categoryId: z.string().uuid().optional(),
  description: z.string().optional(),
  date: isoDate,
  notes: z.string().optional(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = createTransactionSchema.omit({ accountId: true }).partial();
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export const listTransactionsQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

export const statsQuerySchema = z.object({
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
});
export type StatsQuery = z.infer<typeof statsQuerySchema>;
