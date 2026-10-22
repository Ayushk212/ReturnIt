import crypto from 'node:crypto';
import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const isTest = process.env.NODE_ENV === 'test';

/**
 * Students on campus Wi-Fi often share a handful of public IPs, so signed-in requests are
 * limited per session token rather than per IP. Anonymous requests fall back to the IP.
 */
function clientKey(req: Request): string {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ') && header.length > 20) {
    return `t:${crypto.createHash('sha256').update(header.slice(7)).digest('hex').slice(0, 24)}`;
  }
  return `ip:${ipKeyGenerator(req.ip ?? '0.0.0.0')}`;
}

// Photos are immutable and cached by the browser; they should never exhaust the API budget.
const isImageRequest = (req: Request) => req.method === 'GET' && /\/(photos\/\d+|avatar)$/.test(req.path);

export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: isTest ? 10_000 : env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  skip: isImageRequest,
  handler: (_req, _res, next) => next(AppError.tooManyRequests('Too many requests. Please wait a moment and try again.')),
});

/** Coarse per-IP ceiling so rotating fake tokens cannot bypass `apiLimiter`. Sized for a shared campus NAT. */
export const ipCeilingLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: isTest ? 100_000 : env.RATE_LIMIT_MAX_REQUESTS * 20,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? '0.0.0.0'),
  skip: isImageRequest,
  handler: (_req, _res, next) => next(AppError.tooManyRequests('Too many requests from this network. Please try again shortly.')),
});

export const claimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isTest ? 1000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  handler: (_req, _res, next) => next(AppError.tooManyRequests('You have sent many requests recently. Please try again later.')),
});

export const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  handler: (_req, _res, next) => next(AppError.tooManyRequests('You are sending messages too quickly. Please slow down.')),
});
