/**
 * Centralized error handling and 404 fallback.
 * Clients never see stack traces or internal messages.
 */
import { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

import { ApiError } from '../utils/errors';
import { zodErrorToDetails } from '../validators/common';
import { logger } from '../utils/logger';
import { errors } from '../utils/errors';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'The requested endpoint does not exist.' },
  });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  // Known, safe errors.
  if (error instanceof ApiError) {
    if (error.status >= 500) {
      logger.error({ err: error, code: error.code, path: req.path }, 'request failed');
    } else {
      logger.info({ code: error.code, path: req.path }, 'request rejected');
    }
    res.status(error.status).json({
      success: false,
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request contains invalid data.',
        details: zodErrorToDetails(error),
      },
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    const mapped =
      error.code === 'LIMIT_FILE_SIZE' ? errors.payloadTooLarge() : errors.badRequest(error.message);
    res.status(mapped.status).json({
      success: false,
      error: { code: mapped.code, message: mapped.message },
    });
    return;
  }

  // Unknown failure — log everything, expose nothing.
  logger.error({ err: error, path: req.path }, 'unhandled error');
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  });
};
