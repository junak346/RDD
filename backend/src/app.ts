/**
 * Express application factory. Kept free of listen()/DB concerns so the API
 * can be tested in-process with supertest.
 */
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/error';
import { globalRateLimiter } from './middleware/rateLimit';
import { apiV1Router } from './routes';
import { logger } from './utils/logger';
import { ok } from './utils/envelope';

export function createApp(): express.Express {
  const app = express();

  // --- Security & platform middleware -------------------------------------
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // correct client IPs behind the reverse proxy

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // images served to the SPA origin
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org', 'https://tile.openstreetmap.org'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind/Leaflet inject styles
          connectSrc: ["'self'", ...config.clientUrls],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin/curl requests (no Origin header) and the SPA origins.
        if (!origin || config.clientUrls.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: false, // Bearer-token auth — no cookies, so CSRF surface is minimal
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/api/v1/health',
      },
      customLogLevel(_req, res, err) {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  app.use(globalRateLimiter);

  // --- Routes --------------------------------------------------------------
  app.get('/health', (_req, res) => {
    ok(res, { status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
  });
  app.use('/api/v1', apiV1Router);

  // --- Error handling ------------------------------------------------------
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
