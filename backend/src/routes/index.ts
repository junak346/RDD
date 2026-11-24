import { Router } from 'express';

import { analyticsRouter, mapsRouter } from './analytics.routes';
import { authRouter } from './auth.routes';
import { healthRouter } from './health.routes';
import { inspectionsRouter } from './inspections.routes';
import { usersRouter } from './users.routes';

/** All versioned API routes are mounted under /api/v1. */
export const apiV1Router = Router();

apiV1Router.use('/auth', authRouter);
apiV1Router.use('/users', usersRouter);
apiV1Router.use('/inspections', inspectionsRouter);
apiV1Router.use('/analytics', analyticsRouter);
apiV1Router.use('/maps', mapsRouter);
apiV1Router.use('/health', healthRouter);
