/**
 * In-memory repository implementations.
 *
 * ⚠️ DEMO MODE ONLY — DATA_MODE=demo. This store lives in process memory,
 * is wiped on restart, and the API marks every response with
 * `meta.dataMode = "demo"` so the UI can display a permanent DEMO banner.
 * Production uses the MongoDB implementations (repositories/mongo).
 */
import crypto from 'crypto';

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
  Severity,
  SummaryStats,
  TimeseriesPoint,
  UserRecord,
} from '../../types/domain';
import {
  IInspectionRepository,
  IPasswordResetRepository,
  IUserRepository,
  NewInspectionInput,
  NewUserInput,
  Repositories,
} from '../types';

function newId(): string {
  return crypto.randomUUID();
}

class MemoryUserRepository implements IUserRepository {
  private readonly users = new Map<string, UserRecord>();

  async create(input: NewUserInput): Promise<UserRecord> {
    const now = new Date();
    const user: UserRecord = {
      id: newId(),
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      role: input.role,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const needle = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === needle) return user;
    }
    return null;
  }

  async update(
    id: string,
    patch: Partial<Pick<UserRecord, 'name' | 'passwordHash' | 'role'>>,
  ): Promise<UserRecord | null> {
    const user = this.users.get(id);
    if (!user) return null;
    const updated: UserRecord = { ...user, ...patch, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  async list(page: number, limit: number): Promise<PagedResult<UserRecord>> {
    const all = [...this.users.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      items: all.slice((page - 1) * limit, page * limit),
      total: all.length,
      page,
      limit,
    };
  }

  async count(): Promise<number> {
    return this.users.size;
  }
}

class MemoryPasswordResetRepository implements IPasswordResetRepository {
  private readonly records = new Map<string, PasswordResetRecord>();

  async create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetRecord> {
    const record: PasswordResetRecord = {
      id: newId(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      usedAt: null,
    };
    this.records.set(record.id, record);
    return record;
  }

  async findValidByHash(tokenHash: string, now: Date): Promise<PasswordResetRecord | null> {
    for (const record of this.records.values()) {
      if (record.tokenHash === tokenHash && !record.usedAt && record.expiresAt > now) {
        return record;
      }
    }
    return null;
  }

  async markUsed(id: string, usedAt: Date): Promise<void> {
    const record = this.records.get(id);
    if (record) this.records.set(id, { ...record, usedAt });
  }

  async invalidateForUser(userId: string): Promise<void> {
    for (const [id, record] of this.records) {
      if (record.userId === userId) this.records.set(id, { ...record, usedAt: new Date() });
    }
  }
}

function matchesAnalyticsFilter(inspection: InspectionRecord, filter: AnalyticsFilter): boolean {
  if (filter.userId && inspection.userId !== filter.userId) return false;
  if (filter.from && inspection.createdAt < filter.from) return false;
  if (filter.to && inspection.createdAt > filter.to) return false;
  if (filter.damageType && !inspection.detections.some((d) => d.className === filter.damageType)) {
    return false;
  }
  if (filter.severity && !inspection.detections.some((d) => d.severity === filter.severity)) {
    return false;
  }
  return true;
}

class MemoryInspectionRepository implements IInspectionRepository {
  private readonly inspections = new Map<string, InspectionRecord>();

  async create(input: NewInspectionInput): Promise<InspectionRecord> {
    const now = new Date();
    const record: InspectionRecord = {
      id: newId(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    this.inspections.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<InspectionRecord | null> {
    return this.inspections.get(id) ?? null;
  }

  async list(query: InspectionListQuery): Promise<PagedResult<InspectionRecord>> {
    let items = [...this.inspections.values()];

    if (query.userId) items = items.filter((item) => item.userId === query.userId);
    if (query.from) items = items.filter((item) => item.createdAt >= query.from!);
    if (query.to) items = items.filter((item) => item.createdAt <= query.to!);
    if (query.damageType) {
      items = items.filter((item) => item.detections.some((d) => d.className === query.damageType));
    }
    if (query.severity) {
      items = items.filter((item) => item.detections.some((d) => d.severity === query.severity));
    }
    if (query.search) {
      const needle = query.search.toLowerCase();
      items = items.filter((item) => {
        const haystack = [
          item.id,
          item.location?.address ?? '',
          item.image.originalName ?? '',
          ...item.detections.map((d) => d.className),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      });
    }

    switch (query.sort) {
      case 'createdAt_asc':
        items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case 'detections_desc':
        items.sort((a, b) => b.summary.detectionCount - a.summary.detectionCount);
        break;
      default:
        items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    return {
      items: items.slice((query.page - 1) * query.limit, query.page * query.limit),
      total: items.length,
      page: query.page,
      limit: query.limit,
    };
  }

  async delete(id: string): Promise<boolean> {
    return this.inspections.delete(id);
  }

  async updateLocation(
    id: string,
    location: InspectionLocation,
  ): Promise<InspectionRecord | null> {
    const record = this.inspections.get(id);
    if (!record) return null;
    const updated: InspectionRecord = {
      ...record,
      location,
      updatedAt: new Date(),
    };
    this.inspections.set(id, updated);
    return updated;
  }

  async recentForUser(userId: string, limit: number): Promise<InspectionRecord[]> {
    return [...this.inspections.values()]
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async summary(filter: AnalyticsFilter): Promise<SummaryStats> {
    const items = [...this.inspections.values()].filter((item) =>
      matchesAnalyticsFilter(item, filter),
    );

    const countsByClass: Record<string, number> = {};
    const countsBySeverity: Record<string, number> = { low: 0, moderate: 0, high: 0 };
    let totalDetections = 0;
    let confidenceSum = 0;
    let highSeverityInspections = 0;
    let withLocation = 0;
    const areaCounts = new Map<string, number>();

    for (const item of items) {
      totalDetections += item.summary.detectionCount;
      if (item.summary.maxSeverity === 'high') highSeverityInspections += 1;
      if (item.location) {
        withLocation += 1;
        const area = (item.location.address ?? '').split(',').slice(-2).join(',').trim();
        if (area) areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
      }
      for (const detection of item.detections) {
        countsByClass[detection.className] = (countsByClass[detection.className] ?? 0) + 1;
        countsBySeverity[detection.severity] = (countsBySeverity[detection.severity] ?? 0) + 1;
        confidenceSum += detection.confidence;
      }
    }

    return {
      totalInspections: items.length,
      totalDetections,
      highSeverityInspections,
      withLocation,
      avgConfidence: totalDetections > 0 ? confidenceSum / totalDetections : null,
      countsByClass,
      countsBySeverity,
      topAreas: [...areaCounts.entries()]
        .map(([area, count]) => ({ area, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
  }

  async timeseries(
    filter: AnalyticsFilter,
    interval: 'day' | 'week' | 'month',
  ): Promise<TimeseriesPoint[]> {
    const items = [...this.inspections.values()].filter((item) =>
      matchesAnalyticsFilter(item, filter),
    );
    const buckets = new Map<string, TimeseriesPoint>();

    for (const item of items) {
      const key = bucketKey(item.createdAt, interval);
      const bucket = buckets.get(key) ?? { date: key, inspections: 0, detections: 0 };
      bucket.inspections += 1;
      bucket.detections += item.summary.detectionCount;
      buckets.set(key, bucket);
    }

    return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  async distribution(filter: AnalyticsFilter): Promise<{
    byClass: Array<{ name: string; count: number }>;
    bySeverity: Array<{ name: string; count: number }>;
  }> {
    const items = [...this.inspections.values()].filter((item) =>
      matchesAnalyticsFilter(item, filter),
    );
    const byClass = new Map<string, number>();
    const bySeverity = new Map<string, number>([
      ['low', 0],
      ['moderate', 0],
      ['high', 0],
    ]);

    for (const item of items) {
      for (const detection of item.detections) {
        byClass.set(detection.className, (byClass.get(detection.className) ?? 0) + 1);
        bySeverity.set(detection.severity, (bySeverity.get(detection.severity) ?? 0) + 1);
      }
    }

    return {
      byClass: [...byClass.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      bySeverity: [...bySeverity.entries()].map(([name, count]) => ({ name, count })),
    };
  }

  async mapReports(filter: AnalyticsFilter): Promise<MapReport[]> {
    return [...this.inspections.values()]
      .filter((item) => matchesAnalyticsFilter(item, filter) && item.location)
      .map((item) => ({
        inspectionId: item.id,
        latitude: item.location!.latitude,
        longitude: item.location!.longitude,
        address: item.location!.address,
        timestamp: item.timestamp,
        damageTypes: [...new Set(item.detections.map((d) => d.className))],
        detectionCount: item.summary.detectionCount,
        maxSeverity: item.summary.maxSeverity,
        maxConfidence:
          item.detections.length > 0
            ? Math.max(...item.detections.map((d) => d.confidence))
            : 0,
      }));
  }
}

function bucketKey(date: Date, interval: 'day' | 'week' | 'month'): string {
  const iso = date.toISOString();
  if (interval === 'month') return iso.slice(0, 7);
  if (interval === 'week') {
    const d = new Date(date);
    const day = (d.getUTCDay() + 6) % 7; // Monday-based
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
  }
  return iso.slice(0, 10);
}

export function createMemoryRepositories(): Repositories {
  return {
    users: new MemoryUserRepository(),
    passwordResets: new MemoryPasswordResetRepository(),
    inspections: new MemoryInspectionRepository(),
  };
}

export type { InspectionSummary, ModelInfoRecord, DetectionRecord, FileRef, Severity };
