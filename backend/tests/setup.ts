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
// New civic-platform tests need generous limits; dedicated limiter behaviour is
// covered by middleware configuration and security docs.
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
process.env.PUBLIC_REPORT_MAX_REQUESTS = '100';
process.env.PUBLIC_REPORT_IDENTICAL_LIMIT = '100';
process.env.PUBLIC_REPORT_DAILY_IP_LIMIT = '100';
process.env.OFFICIAL_COOKIE_SECURE = 'false';
process.env.MODEL_CONFIDENCE_THRESHOLD = '0.35';

export {};
