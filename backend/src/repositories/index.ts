/**
 * Repository factory — picks the implementation from DATA_MODE.
 *
 *   mongo (default) → real MongoDB (production)
 *   demo            → in-memory store, responses tagged meta.dataMode="demo"
 */
import { config } from '../config';
import { createMemoryRepositories } from './memory';
import { createMongoRepositories } from './mongo';
import { Repositories } from './types';

let cached: Repositories | null = null;

export function getRepositories(): Repositories {
  if (!cached) {
    cached = config.isDemoData ? createMemoryRepositories() : createMongoRepositories();
  }
  return cached;
}

/** Test hook — replaces the repository set (used by unit tests). */
export function setRepositories(repositories: Repositories): void {
  cached = repositories;
}

export function resetRepositories(): void {
  cached = null;
}

export * from './types';
