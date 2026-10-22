import type http from 'node:http';
import { Server } from 'socket.io';
import { resolveUserFromToken } from './middleware/auth.js';
import { logger } from './config/logger.js';

/**
 * Real-time delivery for chat. Messages are always written through the REST API;
 * sockets only push "something changed" events to the two participants, so a client
 * that loses its socket still works and simply refetches.
 */
let io: Server | null = null;

export function attachRealtime(server: http.Server, allowedOrigins: string[]): Server {
  io = new Server(server, {
    path: '/socket.io',
    cors: { origin: allowedOrigins, credentials: true },
    serveClient: false,
  });

  io.use(async (socket, next) => {
    try {
      const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';
      if (!token) return next(new Error('unauthorized'));
      const user = await resolveUserFromToken(token);
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    void socket.join(`user:${socket.data.userId as string}`);
  });

  logger.info('Realtime chat channel ready');
  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}
