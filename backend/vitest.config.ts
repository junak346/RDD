import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Integration tests may spin up an in-memory MongoDB — keep workers low.
    pool: 'forks',
  },
});
