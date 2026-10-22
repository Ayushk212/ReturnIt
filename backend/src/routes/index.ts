import { Router, Request, Response } from 'express';
import { isDatabaseHealthy } from '../config/db.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import itemRoutes from './item.routes.js';
import claimRoutes from './claim.routes.js';
import conversationRoutes from './conversation.routes.js';

const router = Router();

// Liveness check
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness check (PostgreSQL readiness)
router.get('/ready', async (_req: Request, res: Response) => {
  const isDbReady = await isDatabaseHealthy();
  if (isDbReady) {
    res.status(200).json({ status: 'ready', database: 'connected' });
  } else {
    res.status(503).json({ status: 'not_ready', database: 'disconnected' });
  }
});

// Mounted API routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/items', itemRoutes);
router.use('/claims', claimRoutes);
router.use('/conversations', conversationRoutes);

export default router;
