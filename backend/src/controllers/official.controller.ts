import { Request, Response } from 'express';

import { config } from '../config';
import {
  OFFICIAL_CSRF_COOKIE,
  OFFICIAL_SESSION_COOKIE,
  officialOf,
} from '../middleware/officialAuth';
import { officialAuthService } from '../services/officialAuth.service';
import { officialService } from '../services/official.service';
import { ReportListQuery } from '../types/civic';
import {
  OfficialActionInput,
  createOfficialSchema,
  statusPatchSchema,
} from '../validators/civic.validators';
import { asyncHandler } from '../utils/asyncHandler';
import { created, ok } from '../utils/envelope';
import { durationToMs } from '../utils/civic';

function listQuery(req: Request): ReportListQuery {
  const query = req.query as unknown as ReportListQuery;
  return {
    search: query.search,
    status: query.status,
    severity: query.severity,
    priority: query.priority,
    departmentId: query.departmentId,
    assignedOfficialId: query.assignedOfficialId,
    damageType: query.damageType,
    from: query.from,
    to: query.to,
    overdueOnly: Boolean(query.overdueOnly),
    sort: query.sort ?? 'createdAt_desc',
    page: Number(query.page ?? 1),
    limit: Number(query.limit ?? 20),
  };
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: config.officialAuth.cookieSecure,
    path: '/api/v1/official',
    maxAge: durationToMs(config.officialAuth.expiresIn),
  };
}

function csrfCookieOptions() {
  // Readable by the SPA (not httpOnly) so the double-submit header can be
  // attached. The session cookie itself remains httpOnly and API-path scoped.
  return { ...cookieOptions(), httpOnly: false, path: '/' };
}

function clearCookieOptions() {
  const options = cookieOptions();
  return {
    httpOnly: options.httpOnly,
    sameSite: options.sameSite,
    secure: options.secure,
    path: options.path,
  };
}

export const officialController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await officialAuthService.login(req.body.email, req.body.password);
    res.cookie(OFFICIAL_SESSION_COOKIE, result.sessionToken, cookieOptions());
    res.cookie(OFFICIAL_CSRF_COOKIE, result.csrfToken, csrfCookieOptions());
    res.setHeader('Cache-Control', 'no-store');
    ok(res, {
      official: result.official,
      csrfToken: result.csrfToken,
      expiresIn: config.officialAuth.expiresIn,
    });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const actor = officialOf(req);
    await officialAuthService.logout(actor.id, actor.name, actor.role);
    res.clearCookie(OFFICIAL_SESSION_COOKIE, clearCookieOptions());
    res.clearCookie(OFFICIAL_CSRF_COOKIE, {
      ...clearCookieOptions(),
      httpOnly: false,
      path: '/',
    });
    ok(res, { message: 'Official session closed.' });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    ok(res, { official: await officialAuthService.me(officialOf(req).id) });
  }),

  dashboard: asyncHandler(async (_req: Request, res: Response) => {
    ok(res, await officialService.dashboard());
  }),

  notifications: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await officialService.notifications(officialOf(req)));
  }),

  listReports: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await officialService.listReports(listQuery(req)));
  }),

  getReport: asyncHandler(async (req: Request, res: Response) => {
    ok(res, { report: await officialService.getReport(req.params.id) });
  }),

  exactLocation: asyncHandler(async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    ok(res, { location: await officialService.getExactLocation(req.params.id) });
  }),

  image: asyncHandler(async (req: Request, res: Response) => {
    const variant = req.query.variant === 'annotated' ? 'annotated' : 'original';
    const image = await officialService.getReportImage(req.params.id, variant);
    res.setHeader('Content-Type', image.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(image.buffer);
  }),

  action: asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as OfficialActionInput;
    const report = await officialService.performAction(req.params.id, input, officialOf(req));
    ok(res, { report });
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const body = statusPatchSchema.parse(req.body);
    const report = await officialService.performAction(
      req.params.id,
      { action: 'STATUS_UPDATE', status: body.status, note: body.note },
      officialOf(req),
    );
    ok(res, { report });
  }),

  bulkStatus: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as OfficialActionInput;
    const report = await officialService.performAction(
      'bulk',
      { ...body, action: 'BULK_STATUS_UPDATE' },
      officialOf(req),
    );
    ok(res, { report, updated: body.reportIds?.length ?? 0 });
  }),

  map: asyncHandler(async (_req: Request, res: Response) => {
    ok(res, { reports: await officialService.mapReports() });
  }),

  analytics: asyncHandler(async (_req: Request, res: Response) => {
    ok(res, await officialService.analytics());
  }),

  incidents: asyncHandler(async (_req: Request, res: Response) => {
    ok(res, { incidents: await officialService.incidents() });
  }),

  departments: asyncHandler(async (_req: Request, res: Response) => {
    ok(res, { departments: await officialService.departments() });
  }),

  createDepartment: asyncHandler(async (req: Request, res: Response) => {
    created(res, { department: await officialService.createDepartment(req.body, officialOf(req)) });
  }),

  updateDepartment: asyncHandler(async (req: Request, res: Response) => {
    ok(res, {
      department: await officialService.updateDepartment(req.params.id, req.body, officialOf(req)),
    });
  }),

  officials: asyncHandler(async (_req: Request, res: Response) => {
    ok(res, { officials: await officialService.officials() });
  }),

  createOfficial: asyncHandler(async (req: Request, res: Response) => {
    // Validate again at the controller boundary; service enforces role policy.
    createOfficialSchema.parse(req.body);
    created(res, { official: await officialService.createOfficial(req.body, officialOf(req)) });
  }),

  auditLogs: asyncHandler(async (req: Request, res: Response) => {
    const reportId = typeof req.query.reportId === 'string' ? req.query.reportId : undefined;
    const limit = Number(req.query.limit ?? 100);
    ok(res, { logs: await officialService.auditLogs(reportId, limit) });
  }),

  settings: asyncHandler(async (_req: Request, res: Response) => {
    ok(res, await officialService.settings());
  }),

  updateSettings: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await officialService.updateSettings(req.body, officialOf(req)));
  }),

  events: asyncHandler(async (req: Request, res: Response) => {
    ok(res, { events: await officialService.events(Number(req.query.limit ?? 50)) });
  }),

  exportCsv: asyncHandler(async (req: Request, res: Response) => {
    const csv = await officialService.exportCsv(listQuery(req), officialOf(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="road-damage-reports.csv"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(csv);
  }),
};
