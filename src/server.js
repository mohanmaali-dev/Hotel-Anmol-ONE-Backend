import app from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env, validateEnvironment } from './config/env.js';
import { logger } from './config/logger.js';

let server;
let shuttingDown = false;

const start = async () => {
  validateEnvironment();
  await connectDatabase();
  server = app.listen(env.port, () => {
    logger.info(`Restaurant Management API listening on port ${env.port} (${env.nodeEnv})`);
  });
  server.on('error', (error) => {
    logger.error(error);
    process.exitCode = 1;
  });
};

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received; shutting down`);

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDatabase();
  clearTimeout(forceExit);
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

start().catch((error) => {
  logger.error(error);
  process.exit(1);
});
