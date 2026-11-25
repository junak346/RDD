/** Shared API/domain types — mirrors the backend contract (see docs/API.md). */

export type UserRole = 'user' | 'inspector' | 'admin';
export type Severity = 'low' | 'moderate' | 'high';

export interface ResponseMeta {
  dataMode: 'mongo' | 'demo';
  serverTime: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ResponseMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthResult {
  user: User;
  token: string;
}

export interface BBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Detection {
  classId: number;
  className: string;
  confidence: number;
  severity: Severity;
  severityScore: number;
  areaRatio: number;
  bbox: BBox;
  segmentation?: number[][] | null;
}

export interface InspectionLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface ModelInfo {
  name: string;
  version: string;
  engine: string;
  device?: string;
  demo: boolean;
  confidenceThreshold?: number;
  iouThreshold?: number;
}

export interface InspectionSummary {
  detectionCount: number;
  countsByClass: Record<string, number>;
  countsBySeverity: Record<string, number>;
  maxSeverity: Severity | null;
}

export interface Inspection {
  id: string;
  userId: string;
  status: 'completed' | 'failed';
  timestamp: string;
  createdAt: string;
  location: InspectionLocation | null;
  model: ModelInfo;
  processingTimeMs: number;
  aiWarnings: string[];
  detections: Detection[];
  summary: InspectionSummary;
  image: {
    url: string;
    originalName?: string;
    mimeType: string;
    size: number;
    width?: number;
    height?: number;
  };
  annotatedImage: { url: string } | null;
  aiDemo: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
}

export interface InspectionListResult {
  items: Inspection[];
  pagination: Pagination;
}

export interface SummaryStats {
  totalInspections: number;
  totalDetections: number;
  highSeverityInspections: number;
  withLocation: number;
  avgConfidence: number | null;
  countsByClass: Record<string, number>;
  countsBySeverity: Record<string, number>;
  topAreas: Array<{ area: string; count: number }>;
}

export interface TimeseriesPoint {
  date: string;
  inspections: number;
  detections: number;
}

export interface DistributionResult {
  byClass: Array<{ name: string; count: number }>;
  bySeverity: Array<{ name: string; count: number }>;
}

export interface MapReport {
  inspectionId: string;
  latitude: number;
  longitude: number;
  address?: string;
  timestamp: string;
  damageTypes: string[];
  detectionCount: number;
  maxSeverity: Severity | null;
  maxConfidence: number;
  inspectionUrl: string;
}

export interface HealthStatus {
  status: string;
  version: string;
  database: { mode: string; connected: boolean; note?: string };
  dataMode: 'mongo' | 'demo';
  ai: {
    reachable: boolean;
    status?: string;
    engine?: string | null;
    modelLoaded?: boolean;
    demo?: boolean;
  };
  uptimeSeconds: number;
}

/** Error surfaced to UI code after normalisation. */
export class AppError extends Error {
  code: string;
  status: number;
  details?: Array<{ field: string; message: string }>;

  constructor(code: string, message: string, status = 0, details?: Array<{ field: string; message: string }>) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = 'AppError';
  }
}

/* ------------------------------------------------------------------------- */
/* Citizen reporting + government portal                                     */
/* ------------------------------------------------------------------------- */

export type CivicStatus =
  | 'SUBMITTED'
  | 'AI_ANALYSIS'
  | 'AI_ANALYSED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED';

export type CivicPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type GovernmentRole = 'SUPER_ADMIN' | 'ADMIN' | 'INSPECTOR' | 'DEPARTMENT_OFFICIAL' | 'VIEWER';

export interface PublicReportStatus {
  publicReportId: string;
  submittedAt: string;
  lastUpdatedAt: string;
  status: CivicStatus;
  generalLocation: { area: string; precision: string; accuracyMeters: number };
  detectedDamageType: string | null;
  severity: Severity | null;
  confidence: number | null;
  noDamageDetected: boolean;
  aiPending: boolean;
  aiDemo: boolean;
  timeline: Array<{ key: string; label: string; state: 'complete' | 'current' | 'pending' }>;
  message: string;
}

export interface OfficialReport {
  id: string;
  publicReportId: string;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  status: CivicStatus;
  priority: CivicPriority;
  aiSeverity: Severity | null;
  noDamageDetected: boolean;
  exactLocation: {
    type: 'Point';
    coordinates: [number, number];
    latitude: number;
    longitude: number;
    accuracy: number;
    capturedAt: string;
  };
  image: {
    url: string;
    width: number | null;
    height: number | null;
    format: string;
    size: number;
    mimeType: string;
    capturedAt: string;
    uploadedAt: string;
  };
  annotatedImageUrl: string | null;
  ai: {
    status: 'pending' | 'complete';
    analysedAt: string | null;
    damageType: string | null;
    confidence: number | null;
    severity: Severity | null;
    detections: Detection[];
    summary: InspectionSummary | null;
    model: ModelInfo | null;
    modelVersion: string | null;
    confidenceThreshold: number | null;
    processingTimeMs: number | null;
    warnings: string[];
    demo: boolean;
    noDamageDetected: boolean;
  };
  officialDecision: {
    status: CivicStatus;
    priority: CivicPriority;
    departmentId: string | null;
    departmentName: string | null;
    assignedOfficialId: string | null;
    assignedOfficialName: string | null;
    dueAt: string | null;
    overdue: boolean;
    resolvedAt: string | null;
    closedAt: string | null;
  };
  incident: {
    id: string | null;
    publicIncidentId: string | null;
    citizenReportCount: number;
  };
  internalNotes: Array<{ id: string; authorName: string; text: string; createdAt: string }>;
  actionHistory: Array<{
    id: string;
    actor: string;
    role: string;
    action: string;
    timestamp: string;
    metadata: Record<string, unknown> | null;
  }>;
  suspicious: boolean;
  archived: boolean;
}

export interface CivicPaged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface OfficialReportFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: CivicStatus;
  severity?: Severity;
  priority?: CivicPriority;
  departmentId?: string;
  assignedOfficialId?: string;
  damageType?: string;
  from?: string;
  to?: string;
  overdueOnly?: boolean;
  sort?: 'createdAt_desc' | 'createdAt_asc' | 'severity_desc' | 'priority_desc';
}

export interface GovernmentOfficial {
  id: string;
  officialId: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  role: GovernmentRole;
  accountStatus: 'ACTIVE' | 'SUSPENDED';
  lastLoginAt: string | null;
  createdAt: string;
}

export interface GovernmentDepartment {
  id: string;
  name: string;
  code: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GovernmentDashboard {
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

export interface GovernmentNotifications {
  newHighPriorityReports: number;
  overdueReports: number;
  assignedToMe: number;
  newReports: number;
  generatedAt: string;
}

export interface GovernmentMapReport {
  id: string;
  publicReportId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  damageType: string | null;
  severity: Severity | null;
  priority: CivicPriority;
  status: CivicStatus;
  confidence: number | null;
  submittedAt: string;
  incidentPublicId: string | null;
  detailUrl: string;
}

export interface GovernmentAnalytics {
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

export interface GovernmentIncident {
  id: string;
  publicIncidentId: string;
  reportCount: number;
  primaryDamageType: string | null;
  maxSeverity: Severity | null;
  latitude: number;
  longitude: number;
  createdAt: string;
}

export interface GovernmentSettings {
  slaRules: Record<string, number>;
  priorityConfiguration: Record<string, string>;
  duplicateRadiusMeters: number;
  duplicateWindowHours: number;
  modelConfiguration: {
    confidenceThreshold: number;
    baselineConfidenceThreshold: number;
    source: string;
    note: string;
  };
  statusCatalog: string[];
  roleCatalog: string[];
  priorityCatalog: string[];
  note: string;
}

/** Backend `/config` view (stored settings plus read-only catalogs). */
export type OfficialSettingsView = GovernmentSettings;

export interface GovernmentAuditLog {
  id: string;
  actor: string;
  actorId?: string;
  role: string;
  action: string;
  timestamp: string;
  reportId?: string;
  reportPublicId?: string;
  metadata?: Record<string, unknown>;
  immutable: true;
}
