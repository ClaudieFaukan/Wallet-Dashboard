import { z } from 'zod';

export const createBudgetLineSchema = z.object({
  categoryId: z.string().uuid(),
  plannedAmount: z.number().int().default(0),
});
export type CreateBudgetLineInput = z.infer<typeof createBudgetLineSchema>;

export const updateBudgetLineSchema = z.object({
  plannedAmount: z.number().int(),
});
export type UpdateBudgetLineInput = z.infer<typeof updateBudgetLineSchema>;

export const yearParamSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});
export type YearParam = z.infer<typeof yearParamSchema>;
