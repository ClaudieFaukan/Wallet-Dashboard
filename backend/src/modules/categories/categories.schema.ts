import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['income', 'expense']),
  color: z.string().optional(),
  icon: z.string().optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
