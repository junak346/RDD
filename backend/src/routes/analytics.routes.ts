import { Router } from 'express';

import { analyticsController, mapsController } from '../controllers/analytics.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../validators/common';
import {
  analyticsFilterSchema,
  timeseriesSchema,
} from '../validators/inspection.validators';

export const analyticsRouter = Router();
export const mapsRouter = Router();

analyticsRouter.use(requireAuth);
analyticsRouter.get('/summary', validate({ query: analyticsFilterSchema }), analyticsController.summary);
analyticsRouter.get('/timeseries', validate({ query: timeseriesSchema }), analyticsController.timeseries);
analyticsRouter.get(
  '/distribution',
  validate({ query: analyticsFilterSchema }),
  analyticsController.distribution,
);

mapsRouter.use(requireAuth);
mapsRouter.get('/reports', validate({ query: analyticsFilterSchema }), mapsController.reports);
