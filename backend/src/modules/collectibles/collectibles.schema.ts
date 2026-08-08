import { z } from 'zod';

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Invalid date' });

const baseFields = {
  name: z.string().min(1),
  setName: z.string().optional(),
  imageUrl: z.string().optional(),
  notes: z.string().optional(),
  purchasePrice: z.number().int(),
  purchaseDate: isoDate,
};

export const createCollectibleSchema = z.discriminatedUnion('itemType', [
  z.object({
    itemType: z.literal('card'),
    ...baseFields,
    cardNumber: z.string().optional(),
    condition: z.enum(['NM', 'LP', 'MP', 'HP', 'DMG']).optional(),
    tcgdexId: z.string().optional(),
    priceSource: z.enum(['tcgdex', 'manual']).default('tcgdex'),
  }),
  z.object({
    itemType: z.literal('sealed'),
    ...baseFields,
    sealedType: z.enum(['booster_box', 'etb', 'blister', 'collection', 'display']).optional(),
    sealedLanguage: z.enum(['FR', 'EN', 'JP']).optional(),
    priceSource: z.enum(['manual', 'pokemonpricetracker', 'poketrace']).default('manual'),
  }),
]);
export type CreateCollectibleInput = z.infer<typeof createCollectibleSchema>;

export const updateCollectibleSchema = z.object({
  name: z.string().min(1).optional(),
  setName: z.string().optional(),
  imageUrl: z.string().optional(),
  notes: z.string().optional(),
  purchasePrice: z.number().int().optional(),
  purchaseDate: isoDate.optional(),
  priceSource: z.enum(['tcgdex', 'manual', 'pokemonpricetracker', 'poketrace']).optional(),
  cardNumber: z.string().optional(),
  condition: z.enum(['NM', 'LP', 'MP', 'HP', 'DMG']).optional(),
  tcgdexId: z.string().optional(),
  sealedType: z.enum(['booster_box', 'etb', 'blister', 'collection', 'display']).optional(),
  sealedLanguage: z.enum(['FR', 'EN', 'JP']).optional(),
});
export type UpdateCollectibleInput = z.infer<typeof updateCollectibleSchema>;

export const manualPriceUpdateSchema = z.object({
  priceEur: z.number().int(),
  priceUsd: z.number().int().optional(),
  note: z.string().optional(),
});
export type ManualPriceUpdateInput = z.infer<typeof manualPriceUpdateSchema>;

export const listCollectiblesQuerySchema = z.object({
  type: z.enum(['card', 'sealed']).optional(),
});
export type ListCollectiblesQuery = z.infer<typeof listCollectiblesQuerySchema>;

export const performanceQuerySchema = z.object({
  sort: z.enum(['best_performers', 'worst_performers']).optional(),
  type: z.enum(['card', 'sealed']).optional(),
});
export type PerformanceQuery = z.infer<typeof performanceQuerySchema>;

export const searchCardQuerySchema = z.object({
  q: z.string().min(1),
});
export type SearchCardQuery = z.infer<typeof searchCardQuerySchema>;
