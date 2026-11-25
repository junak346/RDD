import { z } from 'zod';

import { config } from '../config';
import {
  OFFICIAL_ACTIONS,
  OFFICIAL_ROLES,
  PRIORITIES,
  REPORT_STATUSES,
} from '../types/civic';
import { isStrongPassword } from '../utils/passwords';

import { dateRangeSchema, paginationSchema } from './common';

export const resourceIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{1,80}$/, 'Must be a valid resource id');

export const publicReportIdSchema = z
  .string()
  .trim()
  .regex(/^RVR-\d{4}-[A-Z0-9]{10}$/i, 'Enter a valid report ID')
  .transform((value) => value.toUpperCase());

const finiteNumber = (min: number, max: number) =>
  z.preprocess((value) => {
    // Strictly accept real numbers or numeric strings — never null, booleans,
    // arrays or objects coerced by accident into 0/1.
    if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
    if (typeof value === 'string' && value.trim() !== '') {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : Number.NaN;
    }
    return Number.NaN;
  }, z.number().min(min).max(max));

export const capturedLocationSchema = z
  .object({
    latitude: finiteNumber(-90, 90),
    longitude: finiteNumber(-180, 180),
    accuracy: finiteNumber(0, config.publicReports.maxLocationAccuracyMeters),
    capturedAt: z.coerce.date(),
  })
  .strict()
  .superRefine((location, context) => {
    const age = Date.now() - location.capturedAt.getTime();
    if (age > config.publicReports.maxLocationAgeMs) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['capturedAt'],
        message: 'Location is too old — please capture it again.',
      });
    }
    if (age < -config.publicReports.maxLocationFutureMs) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['capturedAt'],
        message: 'Location timestamp is in the future.',
      });
    }
    // Reject obvious zero-island / placeholder coordinates.
    if (Math.abs(location.latitude) < 0.000001 && Math.abs(location.longitude) < 0.000001) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['latitude'],
        message: 'Location coordinates are not plausible.',
      });
    }
  });

/** Multipart sends location as a JSON string; parse BEFORE trusting its fields. */
export const createPublicReportSchema = z.object({
  location: z.preprocess((value) => {
    if (typeof value !== 'string' || value.trim().length < 2 || value.length > 2000) {
      return { invalidLocation: true };
    }
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return { invalidLocation: true };
    }
  }, capturedLocationSchema),
});

export const officialLoginSchema = z.object({
  email: z.string().trim().email().max(254).toLowerCase(),
  password: z.string().min(1).max(128),
});

const strongOfficialPassword = z
  .string()
  .min(12, 'Official passwords must be at least 12 characters')
  .max(128)
  .refine(isStrongPassword, 'Password must include letters and a number')
  .refine((value) => /[^A-Za-z0-9]/.test(value), 'Password must include a symbol')
  .refine((value) => /[A-Z]/.test(value), 'Password must include an uppercase letter');

export const createOfficialSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254).toLowerCase(),
    department: z.string().trim().min(2).max(120),
    designation: z.string().trim().min(2).max(120),
    role: z.enum(OFFICIAL_ROLES),
    password: strongOfficialPassword,
  })
  .strict();

export const createDepartmentSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    code: z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9_-]+$/),
    description: z.string().trim().max(500).default(''),
  })
  .strict();

export const updateDepartmentSchema = createDepartmentSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field is required',
);

export const listOfficialReportsSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z.enum(REPORT_STATUSES).optional(),
  severity: z.enum(['low', 'moderate', 'high']).optional(),
  priority: z.enum(PRIORITIES).optional(),
  departmentId: resourceIdSchema.optional(),
  assignedOfficialId: resourceIdSchema.optional(),
  damageType: z.string().trim().max(60).optional(),
  overdueOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  sort: z
    .enum(['createdAt_desc', 'createdAt_asc', 'severity_desc', 'priority_desc'])
    .default('createdAt_desc'),
  ...dateRangeSchema.shape,
});

export const officialActionSchema = z
  .object({
    action: z.enum(OFFICIAL_ACTIONS),
    status: z.enum(REPORT_STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    departmentId: resourceIdSchema.optional(),
    assignedOfficialId: resourceIdSchema.optional(),
    dueAt: z.coerce.date().optional(),
    note: z.string().trim().min(1).max(4000).optional(),
    reason: z.string().trim().min(1).max(500).optional(),
    reportIds: z.array(resourceIdSchema).min(1).max(50).optional(),
  })
  .strict();

export const statusPatchSchema = z
  .object({
    status: z.enum(REPORT_STATUSES),
    note: z.string().trim().max(4000).optional(),
  })
  .strict();

export const settingsPatchSchema = z
  .object({
    slaRules: z
      .record(z.coerce.number().positive().max(24 * 365))
      .refine(
        (rules) => Object.keys(rules).every((key) => PRIORITIES.includes(key as (typeof PRIORITIES)[number])),
        'SLA rule keys must match configured priorities',
      )
      .optional(),
    priorityConfiguration: z.record(z.string().trim().max(120)).optional(),
    duplicateRadiusMeters: z.coerce.number().positive().max(10_000).optional(),
    duplicateWindowHours: z.coerce.number().positive().max(24 * 90).optional(),
    modelConfiguration: z
      .object({
        confidenceThreshold: z.coerce.number().min(0).max(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one setting is required');

export type CapturedLocationInput = z.infer<typeof capturedLocationSchema>;
export type CreatePublicReportInput = z.infer<typeof createPublicReportSchema>;
export type OfficialActionInput = z.infer<typeof officialActionSchema>;
