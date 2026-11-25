import crypto from 'crypto';

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

/**
 * Anonymous submissions get a dedicated low limit. Keying by trusted proxy-aware
 * req.ip (app sets trust proxy=1) makes this an IP throttle in addition to the
 * global limiter and the in-process abuse guard.
 */
export const publicReportRateLimiter = rateLimit({
  windowMs: config.publicReports.windowMs,
  max: config.publicReports.max,
  standardHeaders,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many reports from this network — please wait before submitting another.',
    },
  },
});

/** Login throttling is keyed by IP + email so one account cannot be sprayed. */
export const officialLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const emailHash = crypto.createHash('sha256').update(email).digest('hex').slice(0, 16);
    return `${req.ip}:${emailHash}`;
  },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many official sign-in attempts — please try again later.',
    },
  },
});
