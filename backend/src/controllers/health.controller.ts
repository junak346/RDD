import { Request, Response } from 'express';

import mongoose from 'mongoose';

import { config } from '../config';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/envelope';
import { getRepositories } from '../repositories';
import { aiClient } from '../services/ai.client';

const startedAt = Date.now();

export const healthController = {
  /** Lightweight liveness probe (no auth, no downstream calls). */
  live: (_req: Request, res: Response) => {
    ok(res, { status: 'ok', uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) });
  },

  /** Readiness probe: reports database + AI service state (never throws). */
  ready: asyncHandler(async (_req: Request, res: Response) => {
    const database =
      config.isDemoData
        ? { mode: 'demo', connected: true, note: 'in-memory demo store (DATA_MODE=demo)' }
        : {
            mode: 'mongo',
            connected: mongoose.connection.readyState === 1,
            note: undefined as string | undefined,
          };

    const ai = await aiClient.health();

    // Exercise the data layer so the probe reflects real readiness.
    let dataLayerOk = true;
    try {
      await getRepositories().users.count();
    } catch {
      dataLayerOk = false;
    }

    const status = database.connected && dataLayerOk ? 'ok' : 'degraded';
    res.status(status === 'ok' ? 200 : 503).json({
      success: true,
      data: {
        status,
        version: '1.0.0',
        database,
        dataMode: config.isDemoData ? 'demo' : 'mongo',
        ai: ai
          ? {
              reachable: true,
              status: ai.status,
              engine: ai.engine,
              modelLoaded: ai.modelLoaded,
              demo: ai.demo,
            }
          : { reachable: false },
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      },
    });
  }),
};
