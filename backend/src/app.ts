import express, { Express, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import {
  corsMiddleware,
  helmetMiddleware,
  hppMiddleware,
  sanitizeMiddleware,
  requestIdMiddleware,
} from './middleware/security.js';
import { apiLimiter, ipCeilingLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError } from './utils/AppError.js';
import routes from './routes/index.js';

export const createApp = (): Express => {
  const app = express();

  // Trust proxy for secure cookies and rate limiting behind reverse proxy
  app.set('trust proxy', 1);

  // Security and Request Tracking
  app.use(requestIdMiddleware);
  app.use(helmetMiddleware);
  app.use(corsMiddleware);

  // Parsers with 100kb payload size limit
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Data Sanitization & Parameter Pollution Prevention
  app.use(sanitizeMiddleware);
  app.use(hppMiddleware);

  // Health and Readiness (unthrottled)
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Mount API router
  app.use('/api', ipCeilingLimiter, apiLimiter, routes);

  // Handle 404 Unmatched Routes
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(AppError.notFound('The requested endpoint does not exist', 'NOT_FOUND'));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
