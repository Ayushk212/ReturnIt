import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { logger } from './config/logger.js';
import { allowedOrigins } from './middleware/security.js';
import { attachRealtime } from './realtime.js';

const startServer = async () => {
  try {
    await connectDatabase();

    const app = createApp();
    const server = http.createServer(app);
    attachRealtime(server, allowedOrigins);

    server.listen(env.PORT, env.API_HOST, () => {
      logger.info(`ReturnIt API running on http://${env.API_HOST}:${env.PORT} in ${env.NODE_ENV} mode`);
    });

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        logger.info('HTTP server closed. Disconnecting database...');
        try {
          await disconnectDatabase();
          logger.info('Graceful shutdown completed.');
          process.exit(0);
        } catch (err) {
          logger.error({ err }, 'Error during database disconnect');
          process.exit(1);
        }
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Graceful shutdown timed out. Forcing process exit.');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.fatal({ err }, 'Fatal error during server startup');
    process.exit(1);
  }
};

startServer();
