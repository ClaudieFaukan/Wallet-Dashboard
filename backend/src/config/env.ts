import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(64),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  ENCRYPTION_KEY: z.string().length(64),

  // API keys/secrets (Revolut, Etherscan, Crypto.com, PokemonPriceTracker, Poketrace) live in
  // `app_settings` (encrypted, editable from Settings) instead of the environment — see
  // backend/src/modules/settings/. Only non-secret app config remains here.
  REVOLUT_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  SOLANA_RPC_URL: z.string().default('https://api.mainnet-beta.solana.com'),
});

export const env = envSchema.parse(process.env);
