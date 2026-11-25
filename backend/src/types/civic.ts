/**
 * Civic reporting domain records. These types are storage-agnostic and are
 * deliberately separate from the legacy authenticated inspection workflow.
 */
import {
  DetectionRecord,
  FileRef,
  InspectionSummary,
  ModelInfoRecord,
  Severity,
} from './domain';

export type { DetectionRecord, FileRef, InspectionSummary, ModelInfoRecord, Severity } from './domain';

export const REPORT_STATUSES = [
  'SUBMITTED',
  'AI_ANALYSIS',
  'AI_ANALYSED',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const OFFICIAL_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'INSPECTOR',
  'DEPARTMENT_OFFICIAL',
  'VIEWER',
] as const;
export type OfficialRole = (typeof OFFICIAL_ROLES)[number];

export const OFFICIAL_ACTIONS = [
  'VERIFY_REPORT',
  'REJECT_REPORT',
  'ASSIGN_DEPARTMENT',
  'ASSIGN_OFFICIAL',
  'CHANGE_PRIORITY',
  'MARK_IN_PROGRESS',
  'ADD_INTERNAL_NOTE',
  'REQUEST_INSPECTION',
  'MARK_RESOLVED',
  'CLOSE_CASE',
  'STATUS_UPDATE',
  'BULK_STATUS_UPDATE',
] as const;
export type OfficialAction = (typeof OFFICIAL_ACTIONS)[number];

export interface GeoPointLocation {
  type: 'Point';
  coordinates: [number, number]; // GeoJSON order: [longitude, latitude]
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: Date;
}

export interface CapturedImage extends FileRef {
  capturedAt: Date;
  uploadedAt: Date;
  format: string;
  sha256: string;
}

export interface RoadReportAiAnalysis {
  analysedAt: Date;
  model: ModelInfoRecord;
  confidenceThreshold: number;
  processingTimeMs: number;
  detections: DetectionRecord[];
  summary: InspectionSummary;
  warnings: string[];
  annotatedImage?: FileRef;
  demo: boolean;
  noDamageDetected: boolean;
}

export interface InternalNote {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: Date;
}

export interface AuditEvent {
  id: string;
  actor: string;
  actorId?: string;
  role: string;
  action: string;
  timestamp: Date;
  reportId?: string;
  reportPublicId?: string;
  metadata?: Record<string, unknown>;
}

export interface RoadReportRecord {
  id: string;
  /** Unguessable human-friendly capability ID; its hash is what we query. */
  publicReportId: string;
  publicIdHash: string;
  citizenAccessTokenHash: string;
  image: CapturedImage;
  annotatedImage?: FileRef;
  imageHash: string;
  location: GeoPointLocation;
  submittedAt: Date;
  aiAnalysis: RoadReportAiAnalysis | null;
  aiSeverity: Severity | null;
  noDamageDetected: boolean;
  priority: Priority;
  status: ReportStatus;
  incidentId: string | null;
  incidentPublicId: string | null;
  incidentReportCount: number;
  departmentId: string | null;
  departmentName: string | null;
  assignedOfficialId: string | null;
  assignedOfficialName: string | null;
  dueAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  internalNotes: InternalNote[];
  auditHistory: AuditEvent[];
  suspicious: boolean;
  sourceIpHash: string | null;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUpdatedAt: Date;
}

export interface IncidentRecord {
  id: string;
  publicIncidentId: string;
  reportIds: string[];
  reportCount: number;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  primaryDamageType: string | null;
  maxSeverity: Severity | null;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfficialRecord {
  id: string;
  officialId: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  role: OfficialRole;
  passwordHash: string;
  accountStatus: 'ACTIVE' | 'SUSPENDED';
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  sessionVersion: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepartmentRecord {
  id: string;
  name: string;
  code: string;
  description: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogRecord extends AuditEvent {
  /** Append-only: repositories expose no update or delete operation. */
  immutable: true;
}

export interface SystemSettingRecord {
  key: string;
  value: unknown;
  updatedAt: Date;
  updatedBy?: string;
}

export interface ReportListQuery {
  search?: string;
  status?: ReportStatus;
  severity?: Severity;
  priority?: Priority;
  departmentId?: string;
  assignedOfficialId?: string;
  damageType?: string;
  from?: Date;
  to?: Date;
  overdueOnly?: boolean;
  sort?: 'createdAt_desc' | 'createdAt_asc' | 'severity_desc' | 'priority_desc';
  page: number;
  limit: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CivicDashboardStats {
  totalReports: number;
  newReports: number;
  underReview: number;
  verified: number;
  highPriority: number;
  inProgress: number;
  resolved: number;
  overdue: number;
  aiAnalysed: number;
  noDamageDetected: number;
  incidents: number;
}

export interface NotificationSummary {
  newHighPriorityReports: number;
  overdueReports: number;
  assignedToMe: number;
  newReports: number;
  generatedAt: string;
}

export interface CivicAnalytics {
  generatedAt: string;
  totalReports: number;
  reportsByDay: Array<{ date: string; reports: number }>;
  reportsByWeek: Array<{ date: string; reports: number }>;
  reportsByMonth: Array<{ date: string; reports: number }>;
  damageTypes: Array<{ name: string; count: number }>;
  severityDistribution: Array<{ name: string; count: number }>;
  reportsByDepartment: Array<{ name: string; count: number }>;
  resolutionRate: number;
  averageResolutionHours: number | null;
  unresolvedReports: number;
  overdueReports: number;
  repeatDamageLocations: number;
  citizenReportVolume: number;
  hotspots: Array<{
    key: string;
    latitude: number;
    longitude: number;
    count: number;
    maxSeverity: Severity | null;
    damageTypes: string[];
  }>;
}

export interface CivicMapReport {
  id: string;
  publicReportId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  damageType: string | null;
  severity: Severity | null;
  priority: Priority;
  status: ReportStatus;
  confidence: number | null;
  submittedAt: string;
  incidentPublicId: string | null;
  detailUrl: string;
}
