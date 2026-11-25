/**
 * Production configuration must never silently fall back to development keys
 * or use one secret for citizen JWTs, public HMACs and official sessions.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const distinctSecrets = {
  JWT_SECRET: 'production-jwt-secret-0123456789',
  HMAC_SECRET: 'production-hmac-secret-0123456789',
  OFFICIAL_JWT_SECRET: 'production-official-secret-0123456789',
};

function stubProduction(overrides: Record<string, string> = {}): void {
  for (const [key, value] of Object.entries({
    OFFICIAL_COOKIE_SECURE: 'true',
    ...distinctSecrets,
    ...overrides,
  })) {
    vi.stubEnv(key, value);
  }
  vi.stubEnv('NODE_ENV', 'production');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('production secret separation', () => {
  it('starts with distinct keys and secure-by-default cookies', async () => {
    stubProduction();
    const { config } = await import('../../src/config');

    expect(config.hmacSecret).toBe(distinctSecrets.HMAC_SECRET);
    expect(config.officialAuth.secret).toBe(distinctSecrets.OFFICIAL_JWT_SECRET);
    expect(config.officialAuth.cookieSecure).toBe(true);
  });

  it('honours an explicit insecure cookie setting for local HTTP-only Compose', async () => {
    stubProduction({ OFFICIAL_COOKIE_SECURE: 'false' });
    const { config } = await import('../../src/config');
    expect(config.officialAuth.cookieSecure).toBe(false);
  });

  it('rejects a missing HMAC secret or a reused official session key', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubProduction({ HMAC_SECRET: '' });
    await expect(import('../../src/config')).rejects.toThrow('Invalid environment configuration');

    vi.resetModules();
    stubProduction({ OFFICIAL_JWT_SECRET: distinctSecrets.JWT_SECRET });
    await expect(import('../../src/config')).rejects.toThrow('Invalid environment configuration');
  });
});
