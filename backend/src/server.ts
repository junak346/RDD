/**
 * Server bootstrap: connect the data layer, start HTTP, graceful shutdown.
 */
import mongoose from 'mongoose';

import { createApp } from './app';
import { config } from './config';
import { createDemoSeed } from './repositories/memory/seed';
import { getRepositories } from './repositories';
import { logger } from './utils/logger';

async function connectDatabase(): Promise<void> {
  if (config.isDemoData) {
    logger.warn(
      'DATA_MODE=demo — using the in-memory demo store. ' +
        'Every API response is tagged meta.dataMode="demo". ' +
        'Set DATA_MODE=mongo with a running MongoDB for production.',
    );
    if (config.demoSeed) {
      await createDemoSeed(getRepositories());
      logger.warn('DEMO_SEED=true — sample demo inspections loaded (clearly-labelled demo data).');
    }
    return;
  }

  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  await mongoose.connect(config.databaseUrl, { serverSelectionTimeoutMS: 8000 });
}

async function main(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info(
      { port: config.port, dataMode: config.dataMode, env: config.env },
      'backend listening',
    );
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      void mongoose.disconnect().finally(() => process.exit(0));
    });
    // Force-exit if connections refuse to drain.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error({ err: error }, 'failed to start backend');
  process.exit(1);
});
