import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

describe('public report rate limiter', () => {
  let app: express.Express;
  const previousLimit = process.env.PUBLIC_REPORT_MAX_REQUESTS;

  beforeAll(async () => {
    // config is loaded once per module graph; reload it with a tiny test limit.
    vi.resetModules();
    process.env.PUBLIC_REPORT_MAX_REQUESTS = '2';
    const { publicReportRateLimiter } = await import('../../src/middleware/rateLimit');
    app = express();
    app.use(publicReportRateLimiter);
    app.post('/probe', (_req, res) => res.status(204).end());
  });

  afterAll(() => {
    if (previousLimit === undefined) delete process.env.PUBLIC_REPORT_MAX_REQUESTS;
    else process.env.PUBLIC_REPORT_MAX_REQUESTS = previousLimit;
    vi.resetModules();
  });

  it('throttles repeated anonymous submissions from one network', async () => {
    await request(app).post('/probe').expect(204);
    await request(app).post('/probe').expect(204);
    const blocked = await request(app).post('/probe').expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});
