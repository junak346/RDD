/**
 * Rate limiting — global protection plus a stricter budget for auth endpoints.
 */
import rateLimit from 'express-rate-limit';

import { config } from '../config';

const standardHeaders = 'draft-7' as const;

export const globalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests — please slow down and try again shortly.',
    },
  },
});

export const authRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts — please try again later.',
    },
  },
});

/** Stricter limit for the expensive AI analysis endpoint. */
export const analysisRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: Math.max(10, Math.floor(config.rateLimit.max / 4)),
  standardHeaders,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Analysis rate limit reached — please wait before submitting more images.',
    },
  },
});
