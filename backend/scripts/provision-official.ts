/**
 * Controlled CLI provisioning for a production MongoDB deployment.
 *
 * Usage (from backend/):
 *   DATA_MODE=mongo DATABASE_URL=mongodb://... \
 *   OFFICIAL_BOOTSTRAP_EMAIL=admin@agency.example \
 *   OFFICIAL_BOOTSTRAP_PASSWORD='a-strong-password' \
 *   OFFICIAL_BOOTSTRAP_NAME='System Administrator' \
 *   npm run provision:official
 *
 * This is intentionally a server-side process, not an HTTP registration route.
 */
import mongoose from 'mongoose';

import { config } from '../src/config';
import { ensureCivicBootstrap } from '../src/services/civicBootstrap.service';

async function main(): Promise<void> {
  if (config.isDemoData) {
    throw new Error('Set DATA_MODE=mongo to provision a persistent official account.');
  }
  if (!config.officialBootstrap) {
    throw new Error('Set OFFICIAL_BOOTSTRAP_EMAIL and OFFICIAL_BOOTSTRAP_PASSWORD first.');
  }
  await mongoose.connect(config.databaseUrl, { serverSelectionTimeoutMS: 8000 });
  await ensureCivicBootstrap();
  // eslint-disable-next-line no-console
  console.log(
    `Provisioning complete for ${config.officialBootstrap.email}. Store the password in your secret manager; it is not printed here.`,
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
