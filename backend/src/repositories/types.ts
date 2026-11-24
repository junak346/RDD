/**
 * Repository interfaces — the data-access contract used by services.
 * Two implementations exist: Mongo (production) and in-memory (explicitly
 * labelled demo mode). Services never know which one is active.
 */
import {
  AnalyticsFilter,
  InspectionListQuery,
  InspectionLocation,
  InspectionRecord,
  InspectionSummary,
  MapReport,
  ModelInfoRecord,
  DetectionRecord,
  FileRef,
  PagedResult,
  PasswordResetRecord,
  SummaryStats,
  TimeseriesPoint,
  UserRecord,
  UserRole,
} from '../types/domain';

export interface NewUserInput {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

export interface NewInspectionInput {
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
}

export interface IUserRepository {
  create(input: NewUserInput): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  update(id: string, patch: Partial<Pick<UserRecord, 'name' | 'passwordHash' | 'role'>>): Promise<UserRecord | null>;
  list(page: number, limit: number): Promise<PagedResult<UserRecord>>;
  count(): Promise<number>;
}

export interface IPasswordResetRepository {
  create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<PasswordResetRecord>;
  findValidByHash(tokenHash: string, now: Date): Promise<PasswordResetRecord | null>;
  markUsed(id: string, usedAt: Date): Promise<void>;
  invalidateForUser(userId: string): Promise<void>;
}

export interface IInspectionRepository {
  create(input: NewInspectionInput): Promise<InspectionRecord>;
  findById(id: string): Promise<InspectionRecord | null>;
  list(query: InspectionListQuery): Promise<PagedResult<InspectionRecord>>;
  delete(id: string): Promise<boolean>;
  updateLocation(id: string, location: InspectionLocation): Promise<InspectionRecord | null>;
  recentForUser(userId: string, limit: number): Promise<InspectionRecord[]>;
  summary(filter: AnalyticsFilter): Promise<SummaryStats>;
  timeseries(filter: AnalyticsFilter, interval: 'day' | 'week' | 'month'): Promise<TimeseriesPoint[]>;
  distribution(filter: AnalyticsFilter): Promise<{
    byClass: Array<{ name: string; count: number }>;
    bySeverity: Array<{ name: string; count: number }>;
  }>;
  mapReports(filter: AnalyticsFilter): Promise<MapReport[]>;
}

export interface Repositories {
  users: IUserRepository;
  passwordResets: IPasswordResetRepository;
  inspections: IInspectionRepository;
}
