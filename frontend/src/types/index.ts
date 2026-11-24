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
