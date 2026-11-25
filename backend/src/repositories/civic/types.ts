/**
 * Data-access contract for the civic reporting platform. Services never know
 * whether MongoDB or the explicitly-labelled in-memory demo store is active.
 * Audit-log records are append-only: this interface exposes no edit/delete.
 */
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
  Severity,
  SystemSettingRecord,
} from '../../types/civic';

export type NewRoadReportInput = Omit<
  RoadReportRecord,
  'id' | 'createdAt' | 'updatedAt' | 'lastUpdatedAt'
> &
  Partial<Pick<RoadReportRecord, 'createdAt' | 'updatedAt' | 'lastUpdatedAt'>>;

export type NewIncidentInput = Omit<IncidentRecord, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<IncidentRecord, 'createdAt' | 'updatedAt'>>;

export type NewOfficialInput = Omit<OfficialRecord, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<OfficialRecord, 'createdAt' | 'updatedAt'>>;

export type NewDepartmentInput = Omit<DepartmentRecord, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<DepartmentRecord, 'createdAt' | 'updatedAt'>>;

export type NewAuditLogInput = Omit<AuditLogRecord, 'id' | 'timestamp' | 'immutable'> &
  Partial<Pick<AuditLogRecord, 'id' | 'timestamp'>>;

export interface NearbyReportQuery {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  since: Date;
  damageType?: string;
}

export interface ICivicRepository {
  // Officials — controlled provisioning only, never public registration.
  createOfficial(input: NewOfficialInput): Promise<OfficialRecord>;
  findOfficialByEmail(email: string): Promise<OfficialRecord | null>;
  findOfficialById(id: string): Promise<OfficialRecord | null>;
  updateOfficial(id: string, patch: Partial<OfficialRecord>): Promise<OfficialRecord | null>;
  listOfficials(): Promise<OfficialRecord[]>;

  // Configurable departments.
  createDepartment(input: NewDepartmentInput): Promise<DepartmentRecord>;
  findDepartmentById(id: string): Promise<DepartmentRecord | null>;
  findDepartmentByName(name: string): Promise<DepartmentRecord | null>;
  updateDepartment(id: string, patch: Partial<DepartmentRecord>): Promise<DepartmentRecord | null>;
  listDepartments(activeOnly?: boolean): Promise<DepartmentRecord[]>;

  // Reports (no deletion API; archiving is the preferred retention action).
  createReport(input: NewRoadReportInput): Promise<RoadReportRecord>;
  findReportById(id: string): Promise<RoadReportRecord | null>;
  findReportByPublicIdHash(hash: string): Promise<RoadReportRecord | null>;
  updateReport(id: string, patch: Partial<RoadReportRecord>): Promise<RoadReportRecord | null>;
  appendReportAudit(id: string, event: AuditEvent): Promise<RoadReportRecord | null>;
  listReports(query: ReportListQuery): Promise<Paged<RoadReportRecord>>;
  allReports(): Promise<RoadReportRecord[]>;
  findNearbyReports(query: NearbyReportQuery): Promise<RoadReportRecord[]>;
  mapReports(): Promise<CivicMapReport[]>;

  // Incident grouping.
  createIncident(input: NewIncidentInput): Promise<IncidentRecord>;
  findIncidentById(id: string): Promise<IncidentRecord | null>;
  updateIncident(id: string, patch: Partial<IncidentRecord>): Promise<IncidentRecord | null>;
  listIncidents(): Promise<IncidentRecord[]>;

  // Append-only global audit log.
  appendAudit(input: NewAuditLogInput): Promise<AuditLogRecord>;
  listAuditLogs(reportId?: string, limit?: number): Promise<AuditLogRecord[]>;

  // Configurable SLA / model / priority settings.
  getSetting(key: string): Promise<SystemSettingRecord | null>;
  setSetting(key: string, value: unknown, updatedBy?: string): Promise<SystemSettingRecord>;
}

/** Haversine distance in metres, shared by memory and service-level checks. */
export function distanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const radius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(latitudeB - latitudeA);
  const dLng = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

export const SEVERITY_RANK: Record<Severity, number> = { low: 0, moderate: 1, high: 2 };
