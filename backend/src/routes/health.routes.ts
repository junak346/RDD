import { Router } from 'express';

import { healthController } from '../controllers/health.controller';

export const healthRouter = Router();

// Spec: GET /api/v1/health reports full readiness (database + AI service).
healthRouter.get('/', healthController.ready);
healthRouter.get('/ready', healthController.ready);
healthRouter.get('/live', healthController.live);
