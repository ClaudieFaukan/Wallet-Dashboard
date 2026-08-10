import { z } from 'zod';

export const updateSettingsSchema = z.object({
  etherscanApiKey: z.string().optional(),
  cryptoComApiKey: z.string().optional(),
  cryptoComApiSecret: z.string().optional(),
  pokemonPriceTrackerApiKey: z.string().optional(),
  poketraceApiKey: z.string().optional(),
  revolutClientId: z.string().optional(),
  revolutClientSecret: z.string().optional(),
  alphaVantageApiKey: z.string().optional(),
  binanceApiKey: z.string().optional(),
  binanceApiSecret: z.string().optional(),
  bybitApiKey: z.string().optional(),
  bybitApiSecret: z.string().optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const testSettingSchema = z.discriminatedUnion('section', [
  z.object({ section: z.literal('etherscan'), etherscanApiKey: z.string().min(1) }),
  z.object({
    section: z.literal('cryptoCom'),
    cryptoComApiKey: z.string().min(1),
    cryptoComApiSecret: z.string().min(1),
  }),
  z.object({
    section: z.literal('pokemonPriceTracker'),
    pokemonPriceTrackerApiKey: z.string().min(1),
  }),
  z.object({ section: z.literal('poketrace'), poketraceApiKey: z.string().min(1) }),
  z.object({
    section: z.literal('revolut'),
    revolutClientId: z.string().min(1),
    revolutClientSecret: z.string().min(1),
  }),
  z.object({ section: z.literal('alphaVantage'), alphaVantageApiKey: z.string().min(1) }),
  z.object({
    section: z.literal('binance'),
    binanceApiKey: z.string().min(1),
    binanceApiSecret: z.string().min(1),
  }),
  z.object({
    section: z.literal('bybit'),
    bybitApiKey: z.string().min(1),
    bybitApiSecret: z.string().min(1),
  }),
]);
export type TestSettingInput = z.infer<typeof testSettingSchema>;
