import { z } from 'zod';

const monthString = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM');

export const createBudgetLineSchema = z.object({
  categoryId: z.string().uuid(),
  plannedAmount: z.number().int().default(0),
  month: monthString.optional(),
});
export type CreateBudgetLineInput = z.infer<typeof createBudgetLineSchema>;

export const updateBudgetLineSchema = z.object({
  plannedAmount: z.number().int(),
});
export type UpdateBudgetLineInput = z.infer<typeof updateBudgetLineSchema>;

export const currentQuerySchema = z.object({
  month: monthString.optional(),
});
export type CurrentQuery = z.infer<typeof currentQuerySchema>;

export const yearParamSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});
export type YearParam = z.infer<typeof yearParamSchema>;
