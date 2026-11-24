import { Request, Response } from 'express';

import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/envelope';
import { analyticsService } from '../services/analytics.service';

function filterFromQuery(req: Request) {
  const query = req.query as Record<string, string>;
  return {
    userId: req.auth!.id,
    isAdmin: req.auth!.role === 'admin',
    damageType: query.damageType,
    severity: query.severity as 'low' | 'moderate' | 'high' | undefined,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  };
}

export const analyticsController = {
  summary: asyncHandler(async (req: Request, res: Response) => {
    const summary = await analyticsService.summary(filterFromQuery(req));
    ok(res, summary);
  }),

  timeseries: asyncHandler(async (req: Request, res: Response) => {
    const interval = (req.query.interval as 'day' | 'week' | 'month') ?? 'day';
    const points = await analyticsService.timeseries(filterFromQuery(req), interval);
    ok(res, { interval, points });
  }),

  distribution: asyncHandler(async (req: Request, res: Response) => {
    const distribution = await analyticsService.distribution(filterFromQuery(req));
    ok(res, distribution);
  }),
};

export const mapsController = {
  reports: asyncHandler(async (req: Request, res: Response) => {
    const reports = await analyticsService.mapReports(filterFromQuery(req));
    ok(res, { reports });
  }),
};
