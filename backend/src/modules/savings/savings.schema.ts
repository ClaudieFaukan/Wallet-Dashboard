import { z } from 'zod';

export const createSavingsGoalSchema = z.object({
  name: z.string().min(1),
  targetAmount: z.number().int().positive(),
  deadline: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  type: z.enum(['emergency_fund', 'custom']).default('custom'),
});
export type CreateSavingsGoalInput = z.infer<typeof createSavingsGoalSchema>;

export const updateSavingsGoalSchema = createSavingsGoalSchema.partial();
export type UpdateSavingsGoalInput = z.infer<typeof updateSavingsGoalSchema>;

export const depositSchema = z.object({
  amount: z.number().int().positive(),
});
export type DepositInput = z.infer<typeof depositSchema>;

export const updateDepositSchema = z.object({
  amount: z.number().int().positive().optional(),
  date: z.string().optional(),
});
export type UpdateDepositInput = z.infer<typeof updateDepositSchema>;
