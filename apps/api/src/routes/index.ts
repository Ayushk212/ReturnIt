import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

// Liveness check
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness check (MongoDB readiness)
router.get('/ready', (_req: Request, res: Response) => {
  const isDbReady = mongoose.connection.readyState === 1;
  if (isDbReady) {
    res.status(200).json({ status: 'ready', database: 'connected' });
  } else {
    res.status(503).json({ status: 'not_ready', database: 'disconnected' });
  }
});

// Mounted API routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

export default router;
