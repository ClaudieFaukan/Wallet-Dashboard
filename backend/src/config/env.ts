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
});

export const env = envSchema.parse(process.env);
