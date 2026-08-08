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

  REVOLUT_CLIENT_ID: z.string().optional(),
  REVOLUT_CLIENT_SECRET: z.string().optional(),
  REVOLUT_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),

  ETHERSCAN_API_KEY: z.string().optional(),
  SOLANA_RPC_URL: z.string().default('https://api.mainnet-beta.solana.com'),
  CRYPTO_COM_API_KEY: z.string().optional(),
  CRYPTO_COM_API_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
