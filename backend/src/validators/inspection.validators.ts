import { z } from 'zod';

import { dateRangeSchema, paginationSchema } from './common';

export const locationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  address: z.string().trim().max(240).optional(),
});

/** Empty strings from multipart forms become undefined, not 0. */
const optionalCoordinate = (min: number, max: number) =>
  z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.coerce.number().min(min).max(max).optional(),
  );

export const createInspectionFieldsSchema = z.object({
  latitude: optionalCoordinate(-90, 90),
  longitude: optionalCoordinate(-180, 180),
  address: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(240).optional(),
  ),
});

export const listInspectionsSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  damageType: z.string().trim().max(60).optional(),
  severity: z.enum(['low', 'moderate', 'high']).optional(),
  sort: z.enum(['createdAt_desc', 'createdAt_asc', 'detections_desc']).default('createdAt_desc'),
  ...dateRangeSchema.shape,
});

export const analyticsFilterSchema = z.object({
  damageType: z.string().trim().max(60).optional(),
  severity: z.enum(['low', 'moderate', 'high']).optional(),
  ...dateRangeSchema.shape,
});

export const timeseriesSchema = analyticsFilterSchema.extend({
  interval: z.enum(['day', 'week', 'month']).default('day'),
});

export const updateLocationSchema = locationSchema;

export type CreateInspectionFields = z.infer<typeof createInspectionFieldsSchema>;
export type ListInspectionsInput = z.infer<typeof listInspectionsSchema>;
export type AnalyticsFilterInput = z.infer<typeof analyticsFilterSchema>;
export type TimeseriesInput = z.infer<typeof timeseriesSchema>;
