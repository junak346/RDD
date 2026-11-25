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
      crossOriginResourcePolicy: { policy: 'same-origin' },
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

  // Only the application's own origin may request camera/geolocation. This is
  // a browser capability boundary, NOT an authentication mechanism.
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()');
    next();
  });

  app.use(
    cors({
      origin(origin, callback) {
        // Official sessions use credentialed cookies: never use a wildcard.
        if (!origin) {
          callback(null, config.clientUrls[0] ?? false);
          return;
        }
        callback(null, config.clientUrls.includes(origin) ? origin : false);
      },
      // Citizen auth remains Bearer-token based; official auth uses SameSite
      // Strict, httpOnly cookies and a double-submit CSRF token.
      credentials: true,
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
