import { config } from '../../config';
import { MemoryCivicRepository } from './memory';
import { MongoCivicRepository } from './mongo';
import { ICivicRepository } from './types';

let cached: ICivicRepository | null = null;

export function getCivicRepository(): ICivicRepository {
  if (!cached) {
    cached = config.isDemoData ? new MemoryCivicRepository() : new MongoCivicRepository();
  }
  return cached;
}

/** Test hook: clear all in-memory civic state between isolated test files. */
export function resetCivicRepository(): void {
  cached = null;
}

export function setCivicRepository(repository: ICivicRepository): void {
  cached = repository;
}

export * from './types';
