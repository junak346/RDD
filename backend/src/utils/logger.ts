import pino from 'pino';

import { config } from '../config';

/**
 * Application logger. Sensitive fields are redacted centrally so they can
 * never leak into logs (see docs/SECURITY.md).
 */
export const logger = pino({
  level: config.isTest ? 'silent' : config.logLevel,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'newPassword',
      'currentPassword',
      '*.password',
      'passwordHash',
      'token',
      'resetToken',
    ],
    censor: '[redacted]',
  },
  base: { service: 'rdd-backend' },
  timestamp: pino.stdTimeFunctions.isoTime,
});
