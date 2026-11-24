import { Router } from 'express';

import { inspectionController } from '../controllers/inspection.controller';
import { requireAuth } from '../middleware/auth';
import { analysisRateLimiter } from '../middleware/rateLimit';
import { uploadSingleImage } from '../middleware/upload';
import { validate } from '../validators/common';
import {
  createInspectionFieldsSchema,
  listInspectionsSchema,
  updateLocationSchema,
} from '../validators/inspection.validators';

export const inspectionsRouter = Router();

inspectionsRouter.use(requireAuth);

inspectionsRouter.post(
  '/',
  analysisRateLimiter,
  uploadSingleImage,
  validate({ body: createInspectionFieldsSchema }),
  inspectionController.create,
);
inspectionsRouter.get('/', validate({ query: listInspectionsSchema }), inspectionController.list);
inspectionsRouter.get('/recent', inspectionController.recent);
inspectionsRouter.get('/:id', inspectionController.get);
inspectionsRouter.delete('/:id', inspectionController.remove);
inspectionsRouter.get('/:id/image', inspectionController.image);
inspectionsRouter.patch(
  '/:id/location',
  validate({ body: updateLocationSchema }),
  inspectionController.setLocation,
);
