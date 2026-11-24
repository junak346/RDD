/**
 * Zod validation middleware. Requests are parsed into typed data; failures
 * produce a consistent 422 VALIDATION_ERROR response with field details.
 */
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, ZodSchema, z } from 'zod';

import { errors } from '../utils/errors';

export const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid id')
  .or(z.string().uuid());

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export function zodErrorToDetails(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query ?? {});
        // Express 4 defines req.query as a getter — replace it with an own
        // property so handlers see the validated, coerced values.
        Object.defineProperty(req, 'query', {
          value: parsedQuery,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      if (schemas.params) req.params = schemas.params.parse(req.params) as Request['params'];
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(errors.validation('The request contains invalid data.', zodErrorToDetails(error)));
        return;
      }
      next(error);
    }
  };
}
