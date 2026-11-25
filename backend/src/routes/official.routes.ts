import { Router } from 'express';
import { z } from 'zod';

import { officialController } from '../controllers/official.controller';
import {
  requireOfficialAuth,
  requireOfficialCsrf,
  requireOfficialRole,
} from '../middleware/officialAuth';
import { officialLoginRateLimiter } from '../middleware/rateLimit';
import { paginationSchema, validate } from '../validators/common';
import {
  createDepartmentSchema,
  createOfficialSchema,
  listOfficialReportsSchema,
  officialActionSchema,
  officialLoginSchema,
  resourceIdSchema,
  settingsPatchSchema,
  statusPatchSchema,
  updateDepartmentSchema,
} from '../validators/civic.validators';

export const officialRouter = Router();

const reportParams = z.object({ id: resourceIdSchema });
const allOfficialRoles = [
  'SUPER_ADMIN',
  'ADMIN',
  'INSPECTOR',
  'DEPARTMENT_OFFICIAL',
  'VIEWER',
] as const;
const actionRoles = ['SUPER_ADMIN', 'ADMIN', 'INSPECTOR', 'DEPARTMENT_OFFICIAL'] as const;
const adminRoles = ['SUPER_ADMIN', 'ADMIN'] as const;

// Login is the ONLY unauthenticated official endpoint. Route obscurity is not
// relied upon: every route below re-verifies the server-side session/role.
officialRouter.post(
  '/auth/login',
  officialLoginRateLimiter,
  validate({ body: officialLoginSchema }),
  officialController.login,
);

officialRouter.use(requireOfficialAuth);

officialRouter.post('/auth/logout', requireOfficialCsrf, officialController.logout);
officialRouter.get('/auth/me', officialController.me);

officialRouter.get('/dashboard', officialController.dashboard);
officialRouter.get('/notifications', officialController.notifications);
officialRouter.get('/analytics', officialController.analytics);
officialRouter.get('/map/reports', officialController.map);
officialRouter.get('/incidents', officialController.incidents);
officialRouter.get('/audit-logs', validate({
  query: paginationSchema.extend({ reportId: resourceIdSchema.optional() }),
}), officialController.auditLogs);
officialRouter.get('/events', validate({
  query: z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }),
}), requireOfficialRole(...adminRoles), officialController.events);

officialRouter.get('/config', officialController.settings);
officialRouter.patch(
  '/config',
  requireOfficialRole(...adminRoles),
  requireOfficialCsrf,
  validate({ body: settingsPatchSchema }),
  officialController.updateSettings,
);

officialRouter.get('/departments', officialController.departments);
officialRouter.post(
  '/departments',
  requireOfficialRole(...adminRoles),
  requireOfficialCsrf,
  validate({ body: createDepartmentSchema }),
  officialController.createDepartment,
);
officialRouter.patch(
  '/departments/:id',
  requireOfficialRole(...adminRoles),
  requireOfficialCsrf,
  validate({ params: reportParams, body: updateDepartmentSchema }),
  officialController.updateDepartment,
);

// Department officials need an assignee list; creation remains admin-only.
officialRouter.get(
  '/officials',
  requireOfficialRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_OFFICIAL'),
  officialController.officials,
);
officialRouter.post(
  '/officials',
  requireOfficialRole(...adminRoles),
  requireOfficialCsrf,
  validate({ body: createOfficialSchema }),
  officialController.createOfficial,
);

officialRouter.get(
  '/reports/export.csv',
  requireOfficialRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_OFFICIAL'),
  validate({ query: listOfficialReportsSchema }),
  officialController.exportCsv,
);
officialRouter.post(
  '/reports/bulk/status',
  requireOfficialRole(...adminRoles),
  requireOfficialCsrf,
  validate({ body: officialActionSchema }),
  officialController.bulkStatus,
);
officialRouter.get(
  '/reports',
  requireOfficialRole(...allOfficialRoles),
  validate({ query: listOfficialReportsSchema }),
  officialController.listReports,
);
officialRouter.get(
  '/reports/:id/location',
  validate({ params: reportParams }),
  officialController.exactLocation,
);
officialRouter.get(
  '/reports/:id/image',
  validate({ params: reportParams }),
  officialController.image,
);
officialRouter.post(
  '/reports/:id/actions',
  requireOfficialRole(...actionRoles),
  requireOfficialCsrf,
  validate({ params: reportParams, body: officialActionSchema }),
  officialController.action,
);
officialRouter.patch(
  '/reports/:id/status',
  requireOfficialRole(...actionRoles),
  requireOfficialCsrf,
  validate({ params: reportParams, body: statusPatchSchema }),
  officialController.updateStatus,
);
officialRouter.get(
  '/reports/:id',
  validate({ params: reportParams }),
  officialController.getReport,
);
