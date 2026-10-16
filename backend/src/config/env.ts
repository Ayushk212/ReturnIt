import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from './logger.js';

// Load from current working directory or monorepo root
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const isTest = process.env.NODE_ENV === 'test';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  API_HOST: z.string().default('0.0.0.0'),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required')
    .default(isTest ? 'mongodb://localhost:27017/test' : 'mongodb://localhost:27017/returnit?replicaSet=rs0&directConnection=true'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Firebase Admin — required in production, optional in development/test
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  // Legacy JWT — kept for backward compat during migration; no longer used for auth
  JWT_ACCESS_SECRET: z
    .string()
    .default(isTest ? 'default_test_jwt_access_secret_min_32_chars_long' : 'unused_legacy_secret_placeholder_32x'),
  JWT_REFRESH_SECRET: z
    .string()
    .default(isTest ? 'default_test_jwt_refresh_secret_min_32_chars_long' : 'unused_legacy_secret_placeholder_32x'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().int().positive().default(7),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production' && !data.FIREBASE_PROJECT_ID) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'FIREBASE_PROJECT_ID is required in production',
      path: ['FIREBASE_PROJECT_ID'],
    });
  }
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
