/**
 * Domain records shared by repositories and services.
 * These deliberately contain no Mongoose types — the data layer is swappable.
 */

export type UserRole = 'user' | 'inspector' | 'admin';
export type Severity = 'low' | 'moderate' | 'high';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface BBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DetectionRecord {
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

export interface FileRef {
  filename: string;
  originalName?: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}

export interface ModelInfoRecord {
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

export interface InspectionRecord {
  id: string;
  userId: string;
  image: FileRef;
  annotatedImage?: FileRef;
  timestamp: Date;
  location: InspectionLocation | null;
  status: 'completed' | 'failed';
  model: ModelInfoRecord;
  processingTimeMs: number;
  aiWarnings: string[];
  detections: DetectionRecord[];
  summary: InspectionSummary;
  createdAt: Date;
  updatedAt: Date;
}

export interface InspectionListQuery {
  userId?: string;
  search?: string;
  damageType?: string;
  severity?: Severity;
  from?: Date;
  to?: Date;
  sort?: 'createdAt_desc' | 'createdAt_asc' | 'detections_desc';
  page: number;
  limit: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AnalyticsFilter {
  userId?: string;
  damageType?: string;
  severity?: Severity;
  from?: Date;
  to?: Date;
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

export interface MapReport {
  inspectionId: string;
  latitude: number;
  longitude: number;
  address?: string;
  timestamp: Date;
  damageTypes: string[];
  detectionCount: number;
  maxSeverity: Severity | null;
  maxConfidence: number;
}

export interface PasswordResetRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}
