import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from './logger.js';

// Load from current working directory or monorepo root. Secrets live only in these
// git-ignored files (or the host's environment), never in source code.
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5050),
  API_HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (Neon connection string)'),
  NEON_AUTH_URL: z.string().url('NEON_AUTH_URL must be the Neon Auth base URL'),
  /** Optional override, defaults to `${NEON_AUTH_URL}/.well-known/jwks.json`. */
  NEON_AUTH_JWKS_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5185'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(300),
});

export type Env = z.infer<typeof envSchema>;

const parseEnv = (): Env => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
    logger.fatal(`Invalid environment variables: ${errorDetails}`);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw new Error(`Invalid environment variables: ${errorDetails}`);
  }
  return result.data;
};

export const env = parseEnv();
