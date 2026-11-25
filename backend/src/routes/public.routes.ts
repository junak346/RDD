import { Router } from 'express';
import { z } from 'zod';

import { publicReportController } from '../controllers/publicReport.controller';
import { publicReportRateLimiter } from '../middleware/rateLimit';
import { uploadSingleImage } from '../middleware/upload';
import { validate } from '../validators/common';
import {
  createPublicReportSchema,
  publicReportIdSchema,
} from '../validators/civic.validators';

export const publicRouter = Router();

/** Public, login-free citizen APIs. No official-only fields are ever returned. */
publicRouter.get('/config', publicReportController.config);

publicRouter.post(
  '/reports',
  publicReportRateLimiter,
  uploadSingleImage,
  validate({ body: createPublicReportSchema }),
  publicReportController.create,
);

publicRouter.get(
  '/reports/:publicId/status',
  validate({ params: z.object({ publicId: publicReportIdSchema }) }),
  publicReportController.status,
);
