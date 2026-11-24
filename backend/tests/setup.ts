/**
 * Test environment. Runs before every test file (vitest setupFiles).
 * Tests always use the explicitly-labelled in-memory demo store and the
 * dev-only reset-token exposure — production config never looks like this.
 */
process.env.NODE_ENV = 'test';
process.env.DATA_MODE = 'demo';
process.env.DEMO_SEED = 'false';
process.env.JWT_SECRET = 'test-secret-value-for-unit-tests';
process.env.JWT_EXPIRES_IN = '1h';
process.env.EXPOSE_RESET_TOKENS = 'true';
process.env.LOG_LEVEL = 'silent';
process.env.AI_SERVICE_URL = 'http://127.0.0.1:8999';
process.env.CLIENT_URL = 'http://localhost:5173';

export {};
