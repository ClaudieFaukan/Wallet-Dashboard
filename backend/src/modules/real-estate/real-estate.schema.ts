import { z } from 'zod';

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Invalid date' });

export const createRealEstateAssetSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['physical', 'scpi', 'crowdfunding']),
  platform: z.string().optional(),
  purchasePrice: z.number().int().nonnegative(),
  currentValue: z.number().int().nonnegative(),
  purchaseDate: isoDate,
  monthlyIncome: z.number().int().default(0),
  surfaceM2: z.number().positive().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateRealEstateAssetInput = z.infer<typeof createRealEstateAssetSchema>;

export const updateRealEstateAssetSchema = createRealEstateAssetSchema.partial();
export type UpdateRealEstateAssetInput = z.infer<typeof updateRealEstateAssetSchema>;

export const recordValueSchema = z.object({
  date: isoDate,
  value: z.number().int().nonnegative(),
  notes: z.string().optional(),
});
export type RecordValueInput = z.infer<typeof recordValueSchema>;
