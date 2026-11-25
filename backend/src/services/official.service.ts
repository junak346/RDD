/**
 * Government command-center business logic. Every operation is authorized
 * server-side, every state change is appended to an immutable-style audit log,
 * and AI evidence is kept distinct from official decisions.
 */
import crypto from 'crypto';

import { Request } from 'express';

import { getCivicRepository, ICivicRepository } from '../repositories/civic';
import {
  AuditEvent,
  CivicAnalytics,
  CivicDashboardStats,
  CivicMapReport,
  DepartmentRecord,
  NotificationSummary,
  OFFICIAL_ACTIONS,
  OFFICIAL_ROLES,
  OfficialAction,
  OfficialRecord,
  OfficialRole,
  Paged,
  PRIORITIES,
  REPORT_STATUSES,
  ReportListQuery,
  ReportStatus,
  RoadReportRecord,
  Severity,
} from '../types/civic';
import {
  OfficialActionInput,
  createDepartmentSchema,
  updateDepartmentSchema,
} from '../validators/civic.validators';
import { auditEvent, escapeCsv } from '../utils/civic';
import { errors } from '../utils/errors';

import { publishDomainEvent, recentDomainEvents } from './domainEvents';
import { officialAuthService, toPublicOfficial } from './officialAuth.service';
import { getReportImageStorage } from './reportStorage';
import {
  CivicSystemSettings,
  getCivicSystemSettings,
  updateCivicSystemSettings,
} from './systemSettings.service';

export type OfficialActor = NonNullable<Request['officialAuth']>;

const ACTION_ROLES: Record<OfficialAction, OfficialRole[]> = {
  VERIFY_REPORT: ['INSPECTOR', 'DEPARTMENT_OFFICIAL', 'ADMIN', 'SUPER_ADMIN'],
  REJECT_REPORT: ['INSPECTOR', 'DEPARTMENT_OFFICIAL', 'ADMIN', 'SUPER_ADMIN'],
  ASSIGN_DEPARTMENT: ['DEPARTMENT_OFFICIAL', 'ADMIN', 'SUPER_ADMIN'],
  ASSIGN_OFFICIAL: ['DEPARTMENT_OFFICIAL', 'ADMIN', 'SUPER_ADMIN'],
  CHANGE_PRIORITY: ['DEPARTMENT_OFFICIAL', 'ADMIN', 'SUPER_ADMIN'],
  MARK_IN_PROGRESS: ['INSPECTOR', 'DEPARTMENT_OFFICIAL', 'ADMIN', 'SUPER_ADMIN'],
  ADD_INTERNAL_NOTE: ['INSPECTOR', 'DEPARTMENT_OFFICIAL', 'ADMIN', 'SUPER_ADMIN'],
  REQUEST_INSPECTION: ['INSPECTOR', 'ADMIN', 'SUPER_ADMIN'],
  MARK_RESOLVED: ['DEPARTMENT_OFFICIAL', 'ADMIN', 'SUPER_ADMIN'],
  CLOSE_CASE: ['ADMIN', 'SUPER_ADMIN'],
  STATUS_UPDATE: ['DEPARTMENT_OFFICIAL', 'ADMIN', 'SUPER_ADMIN'],
  BULK_STATUS_UPDATE: ['ADMIN', 'SUPER_ADMIN'],
};

const OFFICIAL_DECISION_STATUSES: ReportStatus[] = [
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
];

const STATUS_FLOW: Record<ReportStatus, ReportStatus[]> = {
  SUBMITTED: ['AI_ANALYSIS', 'AI_ANALYSED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED'],
  AI_ANALYSIS: ['AI_ANALYSED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED'],
  AI_ANALYSED: ['UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'ASSIGNED', 'IN_PROGRESS'],
  UNDER_REVIEW: ['VERIFIED', 'REJECTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'],
  VERIFIED: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'],
  REJECTED: ['CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'RESOLVED', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED', 'REJECTED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

const SEVERITY_RANK: Record<Severity, number> = { low: 0, moderate: 1, high: 2 };

function primaryDamageType(report: RoadReportRecord): string | null {
  const counts = report.aiAnalysis?.summary.countsByClass ?? {};
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function maxConfidence(report: RoadReportRecord): number | null {
  const detections = report.aiAnalysis?.detections ?? [];
  return detections.length ? Math.max(...detections.map((item) => item.confidence)) : null;
}

function isOverdue(report: RoadReportRecord, now = new Date()): boolean {
  return Boolean(
    report.dueAt &&
      report.dueAt < now &&
      !['RESOLVED', 'CLOSED', 'REJECTED'].includes(report.status),
  );
}

function isUnresolved(report: RoadReportRecord): boolean {
  return !['RESOLVED', 'CLOSED', 'REJECTED'].includes(report.status);
}

function assertActionRole(role: OfficialRole, action: OfficialAction): void {
  if (!ACTION_ROLES[action].includes(role)) {
    throw errors.forbidden('Your official role does not permit this action.');
  }
}

function assertTransition(current: ReportStatus, target: ReportStatus): void {
  if (!STATUS_FLOW[current].includes(target)) {
    throw errors.conflict(`Status cannot change from ${current} to ${target}.`);
  }
}

function weekKey(date: Date): string {
  const monday = new Date(date);
  const day = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - day);
  return monday.toISOString().slice(0, 10);
}

function countBy<T>(items: T[], selector: (item: T) => string | null): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = selector(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function toOfficialReportDto(report: RoadReportRecord) {
  const analysis = report.aiAnalysis;
  return {
    id: report.id,
    publicReportId: report.publicReportId,
    submittedAt: report.submittedAt.toISOString(),
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.lastUpdatedAt.toISOString(),
    status: report.status,
    priority: report.priority,
    aiSeverity: report.aiSeverity,
    noDamageDetected: report.noDamageDetected,
    exactLocation: {
      type: 'Point',
      coordinates: report.location.coordinates,
      latitude: report.location.latitude,
      longitude: report.location.longitude,
      accuracy: report.location.accuracy,
      capturedAt: report.location.capturedAt.toISOString(),
    },
    image: {
      url: `/api/v1/official/reports/${report.id}/image?variant=original`,
      width: report.image.width ?? null,
      height: report.image.height ?? null,
      format: report.image.format,
      size: report.image.size,
      mimeType: report.image.mimeType,
      capturedAt: report.image.capturedAt.toISOString(),
      uploadedAt: report.image.uploadedAt.toISOString(),
    },
    annotatedImageUrl: report.annotatedImage || analysis?.annotatedImage
      ? `/api/v1/official/reports/${report.id}/image?variant=annotated`
      : null,
    ai: {
      status: analysis ? 'complete' : 'pending',
      analysedAt: analysis?.analysedAt.toISOString() ?? null,
      damageType: primaryDamageType(report),
      confidence: maxConfidence(report),
      severity: report.aiSeverity,
      detections: analysis?.detections ?? [],
      summary: analysis?.summary ?? null,
      model: analysis?.model ?? null,
      modelVersion: analysis?.model.version ?? null,
      confidenceThreshold: analysis?.confidenceThreshold ?? null,
      processingTimeMs: analysis?.processingTimeMs ?? null,
      warnings: analysis?.warnings ?? [],
      demo: Boolean(analysis?.demo),
      noDamageDetected: report.noDamageDetected,
    },
    officialDecision: {
      status: report.status,
      priority: report.priority,
      departmentId: report.departmentId,
      departmentName: report.departmentName,
      assignedOfficialId: report.assignedOfficialId,
      assignedOfficialName: report.assignedOfficialName,
      dueAt: report.dueAt?.toISOString() ?? null,
      overdue: isOverdue(report),
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      closedAt: report.closedAt?.toISOString() ?? null,
    },
    incident: {
      id: report.incidentId,
      publicIncidentId: report.incidentPublicId,
      citizenReportCount: report.incidentReportCount,
    },
    internalNotes: report.internalNotes.map((note) => ({
      id: note.id,
      authorName: note.authorName,
      text: note.text,
      createdAt: note.createdAt.toISOString(),
    })),
    actionHistory: report.auditHistory.map((entry) => ({
      id: entry.id,
      actor: entry.actor,
      role: entry.role,
      action: entry.action,
      timestamp: entry.timestamp.toISOString(),
      metadata: entry.metadata ?? null,
    })),
    suspicious: report.suspicious,
    archived: report.archived,
  };
}

export type OfficialReportDto = ReturnType<typeof toOfficialReportDto>;

async function recordOfficialAudit(
  repo: ICivicRepository,
  report: RoadReportRecord,
  action: string,
  actor: OfficialActor,
  metadata?: Record<string, unknown>,
): Promise<RoadReportRecord> {
  const event: AuditEvent = auditEvent({
    actor: actor.name,
    actorId: actor.id,
    role: actor.role,
    action,
    reportId: report.id,
    reportPublicId: report.publicReportId,
    metadata,
  });
  await repo.appendAudit({ ...event });
  return (await repo.appendReportAudit(report.id, event)) ?? report;
}

function dueAtForPriority(
  priority: RoadReportRecord['priority'],
  settings: CivicSystemSettings,
  now = new Date(),
): Date | null {
  const hours = settings.slaRules[priority];
  return typeof hours === 'number' && Number.isFinite(hours) && hours > 0
    ? new Date(now.getTime() + hours * 60 * 60 * 1000)
    : null;
}

export type OfficialSettingsView = CivicSystemSettings & {
  statusCatalog: readonly string[];
  roleCatalog: readonly string[];
  priorityCatalog: readonly string[];
  note: string;
};

export const officialService = {
  toOfficialReportDto,

  async dashboard(): Promise<CivicDashboardStats> {
    const repo = getCivicRepository();
    const reports = (await repo.allReports()).filter((report) => !report.archived);
    const incidents = await repo.listIncidents();
    const now = new Date();
    return {
      totalReports: reports.length,
      newReports: reports.filter((report) =>
        ['SUBMITTED', 'AI_ANALYSIS', 'AI_ANALYSED'].includes(report.status),
      ).length,
      underReview: reports.filter((report) => report.status === 'UNDER_REVIEW').length,
      verified: reports.filter((report) => report.status === 'VERIFIED').length,
      highPriority: reports.filter((report) =>
        ['HIGH', 'CRITICAL'].includes(report.priority),
      ).length,
      inProgress: reports.filter((report) => report.status === 'IN_PROGRESS').length,
      resolved: reports.filter((report) => report.status === 'RESOLVED').length,
      overdue: reports.filter((report) => isOverdue(report, now)).length,
      aiAnalysed: reports.filter((report) => Boolean(report.aiAnalysis)).length,
      noDamageDetected: reports.filter((report) => report.noDamageDetected).length,
      incidents: incidents.length,
    };
  },

  async notifications(actor: OfficialActor): Promise<NotificationSummary> {
    const reports = (await getCivicRepository().allReports()).filter((report) => !report.archived);
    return {
      newHighPriorityReports: reports.filter(
        (report) =>
          ['HIGH', 'CRITICAL'].includes(report.priority) &&
          ['SUBMITTED', 'AI_ANALYSIS', 'AI_ANALYSED'].includes(report.status),
      ).length,
      overdueReports: reports.filter((report) => isOverdue(report)).length,
      assignedToMe: reports.filter(
        (report) => report.assignedOfficialId === actor.id && isUnresolved(report),
      ).length,
      newReports: reports.filter((report) =>
        ['SUBMITTED', 'AI_ANALYSIS', 'AI_ANALYSED'].includes(report.status),
      ).length,
      generatedAt: new Date().toISOString(),
    };
  },

  async listReports(query: ReportListQuery): Promise<Paged<OfficialReportDto>> {
    const result = await getCivicRepository().listReports(query);
    return {
      ...result,
      items: result.items.map(toOfficialReportDto),
    };
  },

  async getReport(id: string): Promise<OfficialReportDto> {
    const report = await getCivicRepository().findReportById(id);
    if (!report || report.archived) throw errors.notFound('Report not found.');
    return toOfficialReportDto(report);
  },

  async getExactLocation(id: string): Promise<OfficialReportDto['exactLocation']> {
    return (await this.getReport(id)).exactLocation;
  },

  async getReportImage(
    id: string,
    variant: 'original' | 'annotated',
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const report = await getCivicRepository().findReportById(id);
    if (!report || report.archived) throw errors.notFound('Report not found.');
    const file =
      variant === 'annotated'
        ? report.annotatedImage ?? report.aiAnalysis?.annotatedImage
        : report.image;
    if (!file) throw errors.notFound('Image not found.');
    const buffer = await getReportImageStorage().read(file.filename);
    return { buffer, mimeType: file.mimeType };
  },

  async mapReports(): Promise<CivicMapReport[]> {
    return getCivicRepository().mapReports();
  },

  async analytics(): Promise<CivicAnalytics> {
    const reports = (await getCivicRepository().allReports()).filter((report) => !report.archived);
    const resolved = reports.filter((report) => report.resolvedAt);
    const resolutionMs = resolved.reduce((sum, report) => {
      const end = report.resolvedAt?.getTime() ?? report.closedAt?.getTime() ?? Date.now();
      return sum + Math.max(0, end - report.submittedAt.getTime());
    }, 0);

    const damageCounts = new Map<string, number>();
    for (const report of reports) {
      for (const [name, count] of Object.entries(report.aiAnalysis?.summary.countsByClass ?? {})) {
        damageCounts.set(name, (damageCounts.get(name) ?? 0) + count);
      }
    }
    const grids = new Map<
      string,
      { latitude: number; longitude: number; count: number; severities: Severity[]; types: Set<string> }
    >();
    for (const report of reports) {
      const key = `${report.location.latitude.toFixed(3)}:${report.location.longitude.toFixed(3)}`;
      const current = grids.get(key) ?? {
        latitude: report.location.latitude,
        longitude: report.location.longitude,
        count: 0,
        severities: [],
        types: new Set<string>(),
      };
      current.count += 1;
      if (report.aiSeverity) current.severities.push(report.aiSeverity);
      const damageType = primaryDamageType(report);
      if (damageType) current.types.add(damageType);
      grids.set(key, current);
    }
    const hotspots = [...grids.entries()]
      .map(([key, value]) => {
        let maxSeverity: Severity | null = null;
        for (const severity of value.severities) {
          if (!maxSeverity || SEVERITY_RANK[severity] > SEVERITY_RANK[maxSeverity]) {
            maxSeverity = severity;
          }
        }
        return {
          key,
          latitude: value.latitude,
          longitude: value.longitude,
          count: value.count,
          maxSeverity,
          damageTypes: [...value.types].sort(),
        };
      })
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

    const timeseries = (selector: (date: Date) => string): Array<{ date: string; reports: number }> =>
      countBy(reports, (report) => selector(report.createdAt))
        .map(({ name, count }) => ({ date: name, reports: count }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return {
      generatedAt: new Date().toISOString(),
      totalReports: reports.length,
      reportsByDay: timeseries((date) => date.toISOString().slice(0, 10)),
      reportsByWeek: timeseries(weekKey),
      reportsByMonth: timeseries((date) => date.toISOString().slice(0, 7)),
      damageTypes: [...damageCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      severityDistribution: ['low', 'moderate', 'high'].map((name) => ({
        name,
        count: reports.filter((report) => report.aiSeverity === name).length,
      })),
      reportsByDepartment: countBy(reports, (report) => report.departmentName),
      resolutionRate: reports.length ? resolved.length / reports.length : 0,
      averageResolutionHours: resolved.length
        ? resolutionMs / resolved.length / (60 * 60 * 1000)
        : null,
      unresolvedReports: reports.filter(isUnresolved).length,
      overdueReports: reports.filter((report) => isOverdue(report)).length,
      repeatDamageLocations: hotspots.filter((hotspot) => hotspot.count >= 2).length,
      citizenReportVolume: reports.length,
      // "Reported Damage Hotspots" is intentionally descriptive, not statistical.
      hotspots,
    };
  },

  async incidents(): Promise<Array<{ id: string; publicIncidentId: string; reportCount: number; primaryDamageType: string | null; maxSeverity: Severity | null; latitude: number; longitude: number; createdAt: string }>> {
    const incidents = await getCivicRepository().listIncidents();
    return incidents.map((incident) => ({
      id: incident.id,
      publicIncidentId: incident.publicIncidentId,
      reportCount: incident.reportCount,
      primaryDamageType: incident.primaryDamageType,
      maxSeverity: incident.maxSeverity,
      latitude: incident.location.coordinates[1],
      longitude: incident.location.coordinates[0],
      createdAt: incident.createdAt.toISOString(),
    }));
  },

  async performAction(
    id: string,
    input: OfficialActionInput,
    actor: OfficialActor,
  ): Promise<OfficialReportDto> {
    const repo = getCivicRepository();
    assertActionRole(actor.role, input.action);

    if (input.action === 'BULK_STATUS_UPDATE') {
      if (!input.reportIds?.length || !input.status) {
        throw errors.validation('reportIds and status are required for a bulk update.');
      }
      const results = await Promise.all(
        input.reportIds.map((reportId) =>
          this.performAction(reportId, { action: 'STATUS_UPDATE', status: input.status, note: input.note }, actor),
        ),
      );
      return results[results.length - 1];
    }

    const report = await repo.findReportById(id);
    if (!report || report.archived) throw errors.notFound('Report not found.');

    const now = new Date();
    const settings = await getCivicSystemSettings(repo);
    let patch: Partial<RoadReportRecord> = {};
    const auditMetadata: Record<string, unknown> = { action: input.action };

    switch (input.action) {
      case 'VERIFY_REPORT': {
        assertTransition(report.status, 'VERIFIED');
        patch = { status: 'VERIFIED' };
        break;
      }
      case 'REJECT_REPORT': {
        if (!input.reason) throw errors.validation('A rejection reason is required.');
        assertTransition(report.status, 'REJECTED');
        patch = {
          status: 'REJECTED',
          internalNotes: [
            ...report.internalNotes,
            {
              id: crypto.randomUUID(),
              authorId: actor.id,
              authorName: actor.name,
              text: `Rejected: ${input.reason}`,
              createdAt: now,
            },
          ],
        };
        auditMetadata.reasonProvided = true;
        break;
      }
      case 'ASSIGN_DEPARTMENT': {
        if (!input.departmentId) throw errors.validation('departmentId is required.');
        const department = await repo.findDepartmentById(input.departmentId);
        if (!department || !department.active) throw errors.validation('Department is not active.');
        assertTransition(report.status, 'ASSIGNED');
        patch = {
          status: 'ASSIGNED',
          departmentId: department.id,
          departmentName: department.name,
          dueAt: input.dueAt ?? report.dueAt ?? dueAtForPriority(report.priority, settings, now),
        };
        auditMetadata.departmentId = department.id;
        break;
      }
      case 'ASSIGN_OFFICIAL': {
        if (!input.assignedOfficialId) throw errors.validation('assignedOfficialId is required.');
        const assignee = await repo.findOfficialById(input.assignedOfficialId);
        if (!assignee || assignee.accountStatus !== 'ACTIVE') {
          throw errors.validation('Assigned official is not active.');
        }
        assertTransition(report.status, 'ASSIGNED');
        patch = {
          status: 'ASSIGNED',
          assignedOfficialId: assignee.id,
          assignedOfficialName: assignee.name,
          dueAt: input.dueAt ?? report.dueAt ?? dueAtForPriority(report.priority, settings, now),
        };
        auditMetadata.assignedOfficialId = assignee.id;
        break;
      }
      case 'CHANGE_PRIORITY': {
        if (!input.priority) throw errors.validation('priority is required.');
        patch = {
          priority: input.priority,
          dueAt: input.dueAt ?? dueAtForPriority(input.priority, settings, now),
        };
        auditMetadata.priority = input.priority;
        break;
      }
      case 'MARK_IN_PROGRESS': {
        assertTransition(report.status, 'IN_PROGRESS');
        patch = { status: 'IN_PROGRESS' };
        break;
      }
      case 'ADD_INTERNAL_NOTE': {
        if (!input.note) throw errors.validation('note is required.');
        patch = {
          internalNotes: [
            ...report.internalNotes,
            {
              id: crypto.randomUUID(),
              authorId: actor.id,
              authorName: actor.name,
              text: input.note,
              createdAt: now,
            },
          ],
        };
        auditMetadata.noteAdded = true;
        break;
      }
      case 'REQUEST_INSPECTION': {
        assertTransition(report.status, 'UNDER_REVIEW');
        patch = { status: 'UNDER_REVIEW' };
        if (input.note) {
          patch.internalNotes = [
            ...report.internalNotes,
            {
              id: crypto.randomUUID(),
              authorId: actor.id,
              authorName: actor.name,
              text: `Inspection requested: ${input.note}`,
              createdAt: now,
            },
          ];
        }
        break;
      }
      case 'MARK_RESOLVED': {
        assertTransition(report.status, 'RESOLVED');
        patch = { status: 'RESOLVED', resolvedAt: now };
        break;
      }
      case 'CLOSE_CASE': {
        assertTransition(report.status, 'CLOSED');
        patch = { status: 'CLOSED', closedAt: now };
        break;
      }
      case 'STATUS_UPDATE': {
        if (!input.status || !OFFICIAL_DECISION_STATUSES.includes(input.status)) {
          throw errors.validation('A valid official decision status is required.');
        }
        assertTransition(report.status, input.status);
        patch = { status: input.status };
        if (input.status === 'RESOLVED') patch.resolvedAt = now;
        if (input.status === 'CLOSED') patch.closedAt = now;
        if (input.priority) {
          patch.priority = input.priority;
          patch.dueAt = input.dueAt ?? dueAtForPriority(input.priority, settings, now);
        }
        if (input.note) auditMetadata.noteProvided = true;
        break;
      }
      default:
        throw errors.badRequest('Unsupported official action.');
    }

    let updated = (await repo.updateReport(report.id, patch)) ?? report;
    updated = await recordOfficialAudit(repo, updated, input.action, actor, auditMetadata);
    publishDomainEvent('REPORT_ACTION', {
      reportPublicId: report.publicReportId,
      reportId: report.id,
      action: input.action,
      role: actor.role,
      status: updated.status,
    });
    return toOfficialReportDto(updated);
  },

  async departments(): Promise<DepartmentRecord[]> {
    return getCivicRepository().listDepartments(false);
  },

  async createDepartment(input: unknown, actor: OfficialActor): Promise<DepartmentRecord> {
    const parsed = createDepartmentSchema.parse(input);
    const repo = getCivicRepository();
    if (await repo.findDepartmentByName(parsed.name)) {
      throw errors.conflict('A department with that name already exists.');
    }
    const departments = await repo.listDepartments(false);
    const code = parsed.code.toUpperCase();
    if (departments.some((department) => department.code === code)) {
      throw errors.conflict('A department with that code already exists.');
    }
    const department = await repo.createDepartment({ ...parsed, code, active: true });
    await repo.appendAudit(
      auditEvent({
        actor: actor.name,
        actorId: actor.id,
        role: actor.role,
        action: 'DEPARTMENT_CREATED',
        metadata: { departmentId: department.id },
      }),
    );
    return department;
  },

  async updateDepartment(id: string, input: unknown, actor: OfficialActor): Promise<DepartmentRecord> {
    const parsed = updateDepartmentSchema.parse(input);
    const repo = getCivicRepository();
    const department = await repo.findDepartmentById(id);
    if (!department) throw errors.notFound('Department not found.');
    const updated = await repo.updateDepartment(id, {
      ...parsed,
      ...(parsed.code ? { code: parsed.code.toUpperCase() } : {}),
    });
    if (!updated) throw errors.notFound('Department not found.');
    await repo.appendAudit(
      auditEvent({
        actor: actor.name,
        actorId: actor.id,
        role: actor.role,
        action: 'DEPARTMENT_UPDATED',
        metadata: { departmentId: id, fields: Object.keys(parsed) },
      }),
    );
    return updated;
  },

  async officials(): Promise<ReturnType<typeof toPublicOfficial>[]> {
    const officials: OfficialRecord[] = await getCivicRepository().listOfficials();
    return officials.map(toPublicOfficial);
  },

  async createOfficial(input: unknown, actor: OfficialActor): Promise<ReturnType<typeof toPublicOfficial>> {
    return officialAuthService.provision(
      input as Parameters<typeof officialAuthService.provision>[0],
      { id: actor.id, name: actor.name, role: actor.role },
    );
  },

  async auditLogs(reportId?: string, limit = 200) {
    return getCivicRepository().listAuditLogs(reportId, limit);
  },

  async settings(): Promise<OfficialSettingsView> {
    return {
      ...(await getCivicSystemSettings()),
      statusCatalog: REPORT_STATUSES,
      roleCatalog: OFFICIAL_ROLES,
      priorityCatalog: PRIORITIES,
      note: 'SLA values are configurable planning defaults, not statutory government service levels.',
    };
  },

  async updateSettings(
    input: {
      slaRules?: Record<string, number>;
      priorityConfiguration?: Record<string, string>;
      duplicateRadiusMeters?: number;
      duplicateWindowHours?: number;
      modelConfiguration?: { confidenceThreshold?: number };
    },
    actor: OfficialActor,
  ): Promise<OfficialSettingsView> {
    const updated = await updateCivicSystemSettings(input, actor.id);
    await getCivicRepository().appendAudit(
      auditEvent({
        actor: actor.name,
        actorId: actor.id,
        role: actor.role,
        action: 'SYSTEM_SETTINGS_UPDATED',
        metadata: { fields: Object.keys(input) },
      }),
    );
    publishDomainEvent('SETTINGS_UPDATED', { actorRole: actor.role, fields: Object.keys(input) });
    void updated;
    return this.settings();
  },

  async events(limit = 50) {
    return recentDomainEvents(limit);
  },

  async exportCsv(query: ReportListQuery, actor: OfficialActor): Promise<string> {
    // Exact coordinates are allowed here only because every caller is an
    // authenticated, authorized official and the endpoint is CSRF-protected.
    const result = await getCivicRepository().listReports({ ...query, page: 1, limit: 100 });
    const headers = [
      'Report ID',
      'Date',
      'Damage',
      'AI Severity',
      'Confidence',
      'Latitude',
      'Longitude',
      'Accuracy (m)',
      'Status',
      'Priority',
      'Department',
      'Assigned Official',
      'Incident',
    ];
    const lines = [headers.map(escapeCsv).join(',')];
    for (const report of result.items) {
      lines.push(
        [
          report.publicReportId,
          report.createdAt.toISOString(),
          primaryDamageType(report) ?? '',
          report.aiSeverity ?? '',
          maxConfidence(report) ?? '',
          report.location.latitude,
          report.location.longitude,
          report.location.accuracy,
          report.status,
          report.priority,
          report.departmentName ?? '',
          report.assignedOfficialName ?? '',
          report.incidentPublicId ?? '',
        ]
          .map(escapeCsv)
          .join(','),
      );
    }
    publishDomainEvent('REPORT_ACTION', {
      action: 'CSV_EXPORT_PREPARED',
      actorId: actor.id,
      count: result.items.length,
    });
    return lines.join('\n');
  },
};

export const OFFICIAL_ACTION_CATALOG = OFFICIAL_ACTIONS;
