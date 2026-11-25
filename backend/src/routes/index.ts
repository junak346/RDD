import { Router } from 'express';

import { analyticsRouter, mapsRouter } from './analytics.routes';
import { authRouter } from './auth.routes';
import { healthRouter } from './health.routes';
import { inspectionsRouter } from './inspections.routes';
import { officialRouter } from './official.routes';
import { publicRouter } from './public.routes';
import { usersRouter } from './users.routes';

/** All versioned API routes are mounted under /api/v1. */
export const apiV1Router = Router();

apiV1Router.use('/auth', authRouter);
apiV1Router.use('/users', usersRouter);
// Public citizen reporting is login-free; official APIs are independently
// authenticated and role-checked. Legacy inspection APIs remain compatible.
apiV1Router.use('/public', publicRouter);
apiV1Router.use('/official', officialRouter);
apiV1Router.use('/inspections', inspectionsRouter);
apiV1Router.use('/analytics', analyticsRouter);
apiV1Router.use('/maps', mapsRouter);
apiV1Router.use('/health', healthRouter);
