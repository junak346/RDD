/**
 * Explicitly-labelled in-memory civic repository for DATA_MODE=demo and tests.
 * It mirrors the Mongo contract, including geo proximity and append-only logs.
 */
import crypto from 'crypto';

import bcrypt from 'bcryptjs';

import { config } from '../../config';
import {
  AuditEvent,
  AuditLogRecord,
  CivicMapReport,
  DepartmentRecord,
  IncidentRecord,
  OfficialRecord,
  Paged,
  ReportListQuery,
  RoadReportRecord,
  SystemSettingRecord,
} from '../../types/civic';
import {
  ICivicRepository,
  NearbyReportQuery,
  NewAuditLogInput,
  NewDepartmentInput,
  NewIncidentInput,
  NewOfficialInput,
  NewRoadReportInput,
  SEVERITY_RANK,
  distanceMeters,
} from './types';

/** Only present in test / seeded demo mode — never in production MongoDB. */
export const DEMO_OFFICIAL = {
  email: 'command.demo@rdd.local',
  password: 'OfficialDemo!2026',
  name: 'Demo Command Officer',
  designation: 'System Administrator',
  department: 'Public Works',
} as const;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function severityRank(value: RoadReportRecord['aiSeverity']): number {
  return value ? SEVERITY_RANK[value] : -1;
}

function priorityRank(value: RoadReportRecord['priority']): number {
  return { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }[value];
}

function primaryDamageType(report: RoadReportRecord): string | null {
  const counts = report.aiAnalysis?.summary.countsByClass ?? {};
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function maxConfidence(report: RoadReportRecord): number | null {
  const detections = report.aiAnalysis?.detections ?? [];
  return detections.length ? Math.max(...detections.map((item) => item.confidence)) : null;
}

export class MemoryCivicRepository implements ICivicRepository {
  private officials = new Map<string, OfficialRecord>();
  private departments = new Map<string, DepartmentRecord>();
  private reports = new Map<string, RoadReportRecord>();
  private incidents = new Map<string, IncidentRecord>();
  private auditLogs: AuditLogRecord[] = [];
  private settings = new Map<string, SystemSettingRecord>();

  constructor() {
    // This repository is only selected for DATA_MODE=demo (or tests), so the
    // labelled demo account can never appear in a production MongoDB store.
    if (config.isDemoData || config.isTest) {
      void this.seedDemoAccounts();
    }
  }

  private async seedDemoAccounts(): Promise<void> {
    const now = new Date();
    const departments: DepartmentRecord[] = [
      { id: 'dept_public_works', name: 'Public Works', code: 'PWD', description: 'Configurable example department', active: true, createdAt: now, updatedAt: now },
      { id: 'dept_road_maintenance', name: 'Road Maintenance', code: 'ROAD', description: 'Configurable example department', active: true, createdAt: now, updatedAt: now },
      { id: 'dept_municipal_engineering', name: 'Municipal Engineering', code: 'ENG', description: 'Configurable example department', active: true, createdAt: now, updatedAt: now },
      { id: 'dept_traffic', name: 'Traffic Department', code: 'TRAFFIC', description: 'Configurable example department', active: true, createdAt: now, updatedAt: now },
    ];
    departments.forEach((department) => this.departments.set(department.id, department));

    // Lower bcrypt cost only for ephemeral labelled demo/test data.
    const passwordHash = bcrypt.hashSync(DEMO_OFFICIAL.password, config.isTest ? 4 : 10);
    const official: OfficialRecord = {
      id: 'official_demo_admin',
      officialId: 'GOV-DEMO-0001',
      name: DEMO_OFFICIAL.name,
      email: DEMO_OFFICIAL.email,
      department: DEMO_OFFICIAL.department,
      designation: DEMO_OFFICIAL.designation,
      role: 'SUPER_ADMIN',
      passwordHash,
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
      sessionVersion: 1,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.officials.set(official.id, official);
  }

  async createOfficial(input: NewOfficialInput): Promise<OfficialRecord> {
    const now = input.createdAt ?? new Date();
    const record: OfficialRecord = {
      ...clone(input),
      id: newId('official'),
      createdAt: now,
      updatedAt: input.updatedAt ?? now,
    };
    this.officials.set(record.id, record);
    return clone(record);
  }

  async findOfficialByEmail(email: string): Promise<OfficialRecord | null> {
    const needle = email.trim().toLowerCase();
    for (const official of this.officials.values()) {
      if (official.email.toLowerCase() === needle) return clone(official);
    }
    return null;
  }

  async findOfficialById(id: string): Promise<OfficialRecord | null> {
    const record = this.officials.get(id);
    return record ? clone(record) : null;
  }

  async updateOfficial(id: string, patch: Partial<OfficialRecord>): Promise<OfficialRecord | null> {
    const current = this.officials.get(id);
    if (!current) return null;
    const updated: OfficialRecord = { ...current, ...clone(patch), id, updatedAt: new Date() };
    this.officials.set(id, updated);
    return clone(updated);
  }

  async listOfficials(): Promise<OfficialRecord[]> {
    return [...this.officials.values()].map((official) => clone(official));
  }

  async createDepartment(input: NewDepartmentInput): Promise<DepartmentRecord> {
    const now = input.createdAt ?? new Date();
    const record: DepartmentRecord = {
      ...clone(input),
      id: newId('dept'),
      createdAt: now,
      updatedAt: input.updatedAt ?? now,
    };
    this.departments.set(record.id, record);
    return clone(record);
  }

  async findDepartmentById(id: string): Promise<DepartmentRecord | null> {
    const record = this.departments.get(id);
    return record ? clone(record) : null;
  }

  async findDepartmentByName(name: string): Promise<DepartmentRecord | null> {
    const needle = name.trim().toLowerCase();
    for (const department of this.departments.values()) {
      if (department.name.toLowerCase() === needle) return clone(department);
    }
    return null;
  }

  async updateDepartment(
    id: string,
    patch: Partial<DepartmentRecord>,
  ): Promise<DepartmentRecord | null> {
    const current = this.departments.get(id);
    if (!current) return null;
    const updated = { ...current, ...clone(patch), id, updatedAt: new Date() };
    this.departments.set(id, updated);
    return clone(updated);
  }

  async listDepartments(activeOnly = false): Promise<DepartmentRecord[]> {
    return [...this.departments.values()]
      .filter((department) => !activeOnly || department.active)
      .map((department) => clone(department));
  }

  async createReport(input: NewRoadReportInput): Promise<RoadReportRecord> {
    const now = input.createdAt ?? new Date();
    const record: RoadReportRecord = {
      ...clone(input),
      id: newId('report'),
      createdAt: now,
      updatedAt: input.updatedAt ?? now,
      lastUpdatedAt: input.lastUpdatedAt ?? now,
    };
    this.reports.set(record.id, record);
    return clone(record);
  }

  async findReportById(id: string): Promise<RoadReportRecord | null> {
    const record = this.reports.get(id);
    return record ? clone(record) : null;
  }

  async findReportByPublicIdHash(hash: string): Promise<RoadReportRecord | null> {
    for (const report of this.reports.values()) {
      if (report.publicIdHash === hash) return clone(report);
    }
    return null;
  }

  async updateReport(
    id: string,
    patch: Partial<RoadReportRecord>,
  ): Promise<RoadReportRecord | null> {
    const current = this.reports.get(id);
    if (!current) return null;
    const updated: RoadReportRecord = {
      ...current,
      ...clone(patch),
      id,
      updatedAt: new Date(),
      lastUpdatedAt: new Date(),
    };
    this.reports.set(id, updated);
    return clone(updated);
  }

  async appendReportAudit(id: string, event: AuditEvent): Promise<RoadReportRecord | null> {
    const current = this.reports.get(id);
    if (!current) return null;
    const updated: RoadReportRecord = {
      ...current,
      auditHistory: [...current.auditHistory, clone(event)],
      updatedAt: event.timestamp,
      lastUpdatedAt: event.timestamp,
    };
    this.reports.set(id, updated);
    return clone(updated);
  }

  async listReports(query: ReportListQuery): Promise<Paged<RoadReportRecord>> {
    const now = Date.now();
    let items = [...this.reports.values()].filter((report) => !report.archived);
    if (query.search) {
      const needle = query.search.toLowerCase();
      items = items.filter((report) =>
        [
          report.publicReportId,
          report.status,
          report.priority,
          report.departmentName ?? '',
          report.assignedOfficialName ?? '',
          report.incidentPublicId ?? '',
          primaryDamageType(report) ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle),
      );
    }
    if (query.status) items = items.filter((report) => report.status === query.status);
    if (query.severity) items = items.filter((report) => report.aiSeverity === query.severity);
    if (query.priority) items = items.filter((report) => report.priority === query.priority);
    if (query.departmentId) items = items.filter((report) => report.departmentId === query.departmentId);
    if (query.assignedOfficialId) {
      items = items.filter((report) => report.assignedOfficialId === query.assignedOfficialId);
    }
    if (query.damageType) {
      items = items.filter((report) =>
        Object.keys(report.aiAnalysis?.summary.countsByClass ?? {}).includes(query.damageType!),
      );
    }
    if (query.from) items = items.filter((report) => report.createdAt >= query.from!);
    if (query.to) items = items.filter((report) => report.createdAt <= query.to!);
    if (query.overdueOnly) {
      items = items.filter(
        (report) =>
          Boolean(report.dueAt) &&
          report.dueAt!.getTime() < now &&
          !['RESOLVED', 'CLOSED', 'REJECTED'].includes(report.status),
      );
    }
    switch (query.sort) {
      case 'createdAt_asc':
        items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case 'severity_desc':
        items.sort((a, b) => severityRank(b.aiSeverity) - severityRank(a.aiSeverity));
        break;
      case 'priority_desc':
        items.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
        break;
      default:
        items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    const total = items.length;
    const start = (query.page - 1) * query.limit;
    return {
      items: items.slice(start, start + query.limit).map((report) => clone(report)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async allReports(): Promise<RoadReportRecord[]> {
    return [...this.reports.values()].map((report) => clone(report));
  }

  async findNearbyReports(query: NearbyReportQuery): Promise<RoadReportRecord[]> {
    return [...this.reports.values()]
      .filter((report) => !report.archived)
      .filter((report) => report.createdAt >= query.since)
      .filter(
        (report) =>
          distanceMeters(
            query.latitude,
            query.longitude,
            report.location.latitude,
            report.location.longitude,
          ) <= query.radiusMeters,
      )
      .filter((report) =>
        query.damageType
          ? Object.keys(report.aiAnalysis?.summary.countsByClass ?? {}).includes(query.damageType)
          : true,
      )
      .map((report) => clone(report));
  }

  async mapReports(): Promise<CivicMapReport[]> {
    return [...this.reports.values()]
      .filter((report) => !report.archived)
      .map((report) => ({
        id: report.id,
        publicReportId: report.publicReportId,
        latitude: report.location.latitude,
        longitude: report.location.longitude,
        accuracy: report.location.accuracy,
        damageType: primaryDamageType(report),
        severity: report.aiSeverity,
        priority: report.priority,
        status: report.status,
        confidence: maxConfidence(report),
        submittedAt: report.submittedAt.toISOString(),
        incidentPublicId: report.incidentPublicId,
        detailUrl: `/official/reports/${report.id}`,
      }));
  }

  async createIncident(input: NewIncidentInput): Promise<IncidentRecord> {
    const now = input.createdAt ?? new Date();
    const record: IncidentRecord = {
      ...clone(input),
      id: newId('incident'),
      createdAt: now,
      updatedAt: input.updatedAt ?? now,
    };
    this.incidents.set(record.id, record);
    return clone(record);
  }

  async findIncidentById(id: string): Promise<IncidentRecord | null> {
    const record = this.incidents.get(id);
    return record ? clone(record) : null;
  }

  async updateIncident(id: string, patch: Partial<IncidentRecord>): Promise<IncidentRecord | null> {
    const current = this.incidents.get(id);
    if (!current) return null;
    const updated: IncidentRecord = { ...current, ...clone(patch), id, updatedAt: new Date() };
    this.incidents.set(id, updated);
    return clone(updated);
  }

  async listIncidents(): Promise<IncidentRecord[]> {
    return [...this.incidents.values()].map((incident) => clone(incident));
  }

  async appendAudit(input: NewAuditLogInput): Promise<AuditLogRecord> {
    const record: AuditLogRecord = {
      ...clone(input),
      id: input.id ?? newId('audit'),
      timestamp: input.timestamp ?? new Date(),
      immutable: true,
    };
    this.auditLogs.push(record);
    return clone(record);
  }

  async listAuditLogs(reportId?: string, limit = 200): Promise<AuditLogRecord[]> {
    return this.auditLogs
      .filter((entry) => !reportId || entry.reportId === reportId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, Math.min(Math.max(limit, 1), 500))
      .map((entry) => clone(entry));
  }

  async getSetting(key: string): Promise<SystemSettingRecord | null> {
    const record = this.settings.get(key);
    return record ? clone(record) : null;
  }

  async setSetting(key: string, value: unknown, updatedBy?: string): Promise<SystemSettingRecord> {
    const record: SystemSettingRecord = { key, value: clone(value), updatedAt: new Date(), updatedBy };
    this.settings.set(key, record);
    return clone(record);
  }
}
