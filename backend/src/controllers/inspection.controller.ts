import { Request, Response } from 'express';

import { asyncHandler } from '../utils/asyncHandler';
import { created, noContent, ok } from '../utils/envelope';
import { errors } from '../utils/errors';
import { getImageBuffer, inspectionService } from '../services/inspection.service';
import { InspectionLocation } from '../types/domain';

function locationFromFields(body: Record<string, unknown>): InspectionLocation | undefined {
  const latitude = body.latitude === undefined || body.latitude === '' ? undefined : Number(body.latitude);
  const longitude =
    body.longitude === undefined || body.longitude === '' ? undefined : Number(body.longitude);
  if (latitude === undefined || longitude === undefined) {
    return undefined;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw errors.validation('latitude and longitude must be numbers.');
  }
  const address = typeof body.address === 'string' && body.address.trim() ? body.address.trim() : undefined;
  return { latitude, longitude, ...(address ? { address } : {}) };
}

export const inspectionController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      throw errors.validation('An image file is required (multipart field "image").');
    }
    const location = locationFromFields(req.body ?? {});

    const inspection = await inspectionService.create({
      userId: req.auth!.id,
      imageBuffer: file.buffer,
      originalName: file.originalname ?? 'upload',
      claimedMime: file.mimetype,
      location,
    });
    created(res, { inspection });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as Record<string, string>;
    const result = await inspectionService.list({
      userId: req.auth!.id,
      isAdmin: req.auth!.role === 'admin',
      search: query.search,
      damageType: query.damageType,
      severity: query.severity as 'low' | 'moderate' | 'high' | undefined,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      sort: query.sort as 'createdAt_desc' | 'createdAt_asc' | 'detections_desc' | undefined,
      page: Number(query.page ?? 1),
      limit: Number(query.limit ?? 10),
    });
    ok(res, result);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const inspection = await inspectionService.get(
      req.params.id,
      req.auth!.id,
      req.auth!.role === 'admin',
    );
    ok(res, { inspection });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await inspectionService.remove(req.params.id, req.auth!.id, req.auth!.role === 'admin');
    noContent(res);
  }),

  setLocation: asyncHandler(async (req: Request, res: Response) => {
    const location = locationFromFields(req.body ?? {});
    if (!location) {
      throw errors.validation('latitude and longitude are required.');
    }
    const inspection = await inspectionService.setLocation(
      req.params.id,
      req.auth!.id,
      req.auth!.role === 'admin',
      location,
    );
    ok(res, { inspection });
  }),

  image: asyncHandler(async (req: Request, res: Response) => {
    const variant = req.query.variant === 'annotated' ? 'annotated' : 'original';
    const { buffer, mimeType } = await getImageBuffer(
      req.params.id,
      req.auth!.id,
      req.auth!.role === 'admin',
      variant,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  }),

  recent: asyncHandler(async (req: Request, res: Response) => {
    const items = await inspectionService.recent(req.auth!.id, Number(req.query.limit ?? 5));
    ok(res, { items });
  }),
};
