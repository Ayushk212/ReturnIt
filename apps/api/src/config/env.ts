import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from './logger.js';

dotenv.config();

const isTest = process.env.NODE_ENV === 'test';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  API_HOST: z.string().default('0.0.0.0'),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required')
    .default(isTest ? 'mongodb://localhost:27017/test' : ''),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters long')
    .default(isTest ? 'default_test_jwt_access_secret_min_32_chars_long' : ''),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long')
    .default(isTest ? 'default_test_jwt_refresh_secret_min_32_chars_long' : ''),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().int().positive().default(7),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
});

export type Env = z.infer<typeof envSchema>;

const parseEnv = (): Env => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    logger.fatal(`Invalid environment variables: ${errorDetails}`);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw new Error(`Invalid environment variables: ${errorDetails}`);
  }
  return result.data;
};

export const env = parseEnv();
