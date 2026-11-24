/**
 * MongoDB repository implementations (production data layer).
 * Thin mapping over the Mongoose models — no business logic lives here.
 */
import { FilterQuery } from 'mongoose';

import { InspectionModel } from '../../models/Inspection';
import { PasswordResetModel } from '../../models/PasswordReset';
import { UserModel } from '../../models/User';
import {
  AnalyticsFilter,
  InspectionListQuery,
  InspectionLocation,
  InspectionRecord,
  MapReport,
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

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function toUserRecord(doc: Record<string, unknown>): UserRecord {
  return {
    id: String(doc._id),
    name: String(doc.name),
    email: String(doc.email),
    passwordHash: typeof doc.passwordHash === 'string' ? doc.passwordHash : '',
    role: doc.role as UserRecord['role'],
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  };
}

type InspectionDoc = Record<string, unknown>;

/* eslint-disable @typescript-eslint/no-explicit-any --
   Mongoose `.toObject()` returns a loosely-typed document; this is the
   single mapping boundary between untyped persistence and typed domain. */
function toInspectionRecord(doc: Record<string, any>): InspectionRecord {
  return {
    id: String(doc._id),
    userId: String(doc.userId),
    image: doc.image,
    annotatedImage: doc.annotatedImage ?? undefined,
    timestamp: doc.timestamp,
    location: doc.location ?? null,
    status: doc.status,
    model: doc.model,
    processingTimeMs: doc.processingTimeMs,
    aiWarnings: doc.aiWarnings ?? [],
    detections: doc.detections ?? [],
    summary: {
      detectionCount: doc.summary?.detectionCount ?? 0,
      countsByClass: Object.fromEntries(doc.summary?.countsByClass ?? new Map()),
      countsBySeverity: Object.fromEntries(doc.summary?.countsBySeverity ?? new Map()),
      maxSeverity: doc.summary?.maxSeverity ?? null,
    },
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

class MongoUserRepository implements IUserRepository {
  async create(input: NewUserInput): Promise<UserRecord> {
    const doc = await UserModel.create(input);
    return toUserRecord({ ...doc.toObject(), passwordHash: input.passwordHash });
  }

  async findById(id: string): Promise<UserRecord | null> {
    const doc = await UserModel.findById(id);
    return doc ? toUserRecord({ ...doc.toObject(), passwordHash: '' }) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const doc = await UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    return doc ? toUserRecord(doc.toObject()) : null;
  }

  async update(
    id: string,
    patch: Partial<Pick<UserRecord, 'name' | 'passwordHash' | 'role'>>,
  ): Promise<UserRecord | null> {
    const doc = await UserModel.findByIdAndUpdate(id, { $set: patch }, { new: true });
    return doc ? toUserRecord({ ...doc.toObject(), passwordHash: '' }) : null;
  }

  async list(page: number, limit: number): Promise<PagedResult<UserRecord>> {
    const [docs, total] = await Promise.all([
      UserModel.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      UserModel.countDocuments(),
    ]);
    return {
      items: docs.map((doc) => toUserRecord({ ...doc.toObject(), passwordHash: '' })),
      total,
      page,
      limit,
    };
  }

  async count(): Promise<number> {
    return UserModel.countDocuments();
  }
}

// ---------------------------------------------------------------------------
// Password resets
// ---------------------------------------------------------------------------

class MongoPasswordResetRepository implements IPasswordResetRepository {
  async create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetRecord> {
    const doc = await PasswordResetModel.create(input);
    return {
      id: String(doc._id),
      userId: String(doc.userId),
      tokenHash: doc.tokenHash,
      expiresAt: doc.expiresAt,
      usedAt: doc.usedAt ?? null,
    };
  }

  async findValidByHash(tokenHash: string, now: Date): Promise<PasswordResetRecord | null> {
    const doc = await PasswordResetModel.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: now },
    });
    return doc
      ? {
          id: String(doc._id),
          userId: String(doc.userId),
          tokenHash: doc.tokenHash,
          expiresAt: doc.expiresAt,
          usedAt: doc.usedAt ?? null,
        }
      : null;
  }

  async markUsed(id: string, usedAt: Date): Promise<void> {
    await PasswordResetModel.updateOne({ _id: id }, { $set: { usedAt } });
  }

  async invalidateForUser(userId: string): Promise<void> {
    await PasswordResetModel.updateMany({ userId, usedAt: null }, { $set: { usedAt: new Date() } });
  }
}

// ---------------------------------------------------------------------------
// Inspections
// ---------------------------------------------------------------------------

function analyticsMatch(filter: AnalyticsFilter): FilterQuery<InspectionDoc> {
  const match: FilterQuery<InspectionDoc> = {};
  if (filter.userId) match.userId = filter.userId;
  if (filter.from || filter.to) {
    match.createdAt = {};
    if (filter.from) (match.createdAt as Record<string, Date>).$gte = filter.from;
    if (filter.to) (match.createdAt as Record<string, Date>).$lte = filter.to;
  }
  if (filter.damageType) match['detections.className'] = filter.damageType;
  if (filter.severity) match['detections.severity'] = filter.severity;
  return match;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class MongoInspectionRepository implements IInspectionRepository {
  async create(input: NewInspectionInput): Promise<InspectionRecord> {
    const doc = await InspectionModel.create({
      ...input,
      summary: {
        ...input.summary,
        countsByClass: input.summary.countsByClass,
        countsBySeverity: input.summary.countsBySeverity,
      },
    });
    return toInspectionRecord(doc.toObject());
  }

  async findById(id: string): Promise<InspectionRecord | null> {
    const doc = await InspectionModel.findById(id);
    return doc ? toInspectionRecord(doc.toObject()) : null;
  }

  async list(query: InspectionListQuery): Promise<PagedResult<InspectionRecord>> {
    const match: FilterQuery<InspectionDoc> = {};
    if (query.userId) match.userId = query.userId;
    if (query.from || query.to) {
      match.createdAt = {};
      if (query.from) (match.createdAt as Record<string, Date>).$gte = query.from;
      if (query.to) (match.createdAt as Record<string, Date>).$lte = query.to;
    }
    if (query.damageType) match['detections.className'] = query.damageType;
    if (query.severity) match['detections.severity'] = query.severity;
    if (query.search) {
      const pattern = new RegExp(escapeRegex(query.search), 'i');
      match.$or = [
        { 'location.address': pattern },
        { 'detections.className': pattern },
        { 'image.originalName': pattern },
      ];
    }

    const sortSpec: Record<string, 1 | -1> =
      query.sort === 'createdAt_asc'
        ? { createdAt: 1 }
        : query.sort === 'detections_desc'
          ? { 'summary.detectionCount': -1, createdAt: -1 }
          : { createdAt: -1 };

    const [docs, total] = await Promise.all([
      InspectionModel.find(match)
        .sort(sortSpec)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      InspectionModel.countDocuments(match),
    ]);

    return {
      items: docs.map((doc) => toInspectionRecord(doc.toObject())),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async delete(id: string): Promise<boolean> {
    const result = await InspectionModel.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }

  async updateLocation(
    id: string,
    location: InspectionLocation,
  ): Promise<InspectionRecord | null> {
    const doc = await InspectionModel.findByIdAndUpdate(
      id,
      { $set: { location } },
      { new: true },
    );
    return doc ? toInspectionRecord(doc.toObject()) : null;
  }

  async recentForUser(userId: string, limit: number): Promise<InspectionRecord[]> {
    const docs = await InspectionModel.find({ userId }).sort({ createdAt: -1 }).limit(limit);
    return docs.map((doc) => toInspectionRecord(doc.toObject()));
  }

  async summary(filter: AnalyticsFilter): Promise<SummaryStats> {
    const match = analyticsMatch(filter);
    const [result] = await InspectionModel.aggregate([
      { $match: match },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalInspections: { $sum: 1 },
                totalDetections: { $sum: '$summary.detectionCount' },
                highSeverityInspections: {
                  $sum: { $cond: [{ $eq: ['$summary.maxSeverity', 'high'] }, 1, 0] },
                },
                withLocation: { $sum: { $cond: [{ $ne: ['$location', null] }, 1, 0] } },
              },
            },
          ],
          detections: [
            { $unwind: '$detections' },
            {
              $group: {
                _id: null,
                avgConfidence: { $avg: '$detections.confidence' },
              },
            },
          ],
          byClass: [
            { $unwind: '$detections' },
            { $group: { _id: '$detections.className', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          bySeverity: [
            { $unwind: '$detections' },
            { $group: { _id: '$detections.severity', count: { $sum: 1 } } },
          ],
          topAreas: [
            { $match: { 'location.address': { $exists: true, $ne: null } } },
            { $group: { _id: '$location.address', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ],
        },
      },
    ]);

    const totals = result?.totals?.[0] ?? {};
    const countsByClass: Record<string, number> = {};
    for (const entry of result?.byClass ?? []) countsByClass[entry._id] = entry.count;
    const countsBySeverity: Record<string, number> = { low: 0, moderate: 0, high: 0 };
    for (const entry of result?.bySeverity ?? []) countsBySeverity[entry._id] = entry.count;

    return {
      totalInspections: totals.totalInspections ?? 0,
      totalDetections: totals.totalDetections ?? 0,
      highSeverityInspections: totals.highSeverityInspections ?? 0,
      withLocation: totals.withLocation ?? 0,
      avgConfidence: result?.detections?.[0]?.avgConfidence ?? null,
      countsByClass,
      countsBySeverity,
      topAreas: (result?.topAreas ?? []).map((entry: { _id: string; count: number }) => ({
        area: entry._id,
        count: entry.count,
      })),
    };
  }

  async timeseries(
    filter: AnalyticsFilter,
    interval: 'day' | 'week' | 'month',
  ): Promise<TimeseriesPoint[]> {
    const dateFormat =
      interval === 'month' ? '%Y-%m' : interval === 'week' ? '%G-W%V' : '%Y-%m-%d';
    const rows = await InspectionModel.aggregate([
      { $match: analyticsMatch(filter) },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          inspections: { $sum: 1 },
          detections: { $sum: '$summary.detectionCount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return rows.map((row) => ({ date: row._id, inspections: row.inspections, detections: row.detections }));
  }

  async distribution(filter: AnalyticsFilter): Promise<{
    byClass: Array<{ name: string; count: number }>;
    bySeverity: Array<{ name: string; count: number }>;
  }> {
    const [byClass, bySeverity] = await Promise.all([
      InspectionModel.aggregate([
        { $match: analyticsMatch(filter) },
        { $unwind: '$detections' },
        { $group: { _id: '$detections.className', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      InspectionModel.aggregate([
        { $match: analyticsMatch(filter) },
        { $unwind: '$detections' },
        { $group: { _id: '$detections.severity', count: { $sum: 1 } } },
      ]),
    ]);

    const severityOrder: Severity[] = ['low', 'moderate', 'high'];
    return {
      byClass: byClass.map((row) => ({ name: row._id, count: row.count })),
      bySeverity: severityOrder.map((name) => ({
        name,
        count: bySeverity.find((row) => row._id === name)?.count ?? 0,
      })),
    };
  }

  async mapReports(filter: AnalyticsFilter): Promise<MapReport[]> {
    const docs = await InspectionModel.find({
      ...analyticsMatch(filter),
      location: { $ne: null },
    }).sort({ createdAt: -1 });

    return docs.map((doc) => {
      const record = toInspectionRecord(doc.toObject());
      return {
        inspectionId: record.id,
        latitude: record.location!.latitude,
        longitude: record.location!.longitude,
        address: record.location!.address,
        timestamp: record.timestamp,
        damageTypes: [...new Set(record.detections.map((d) => d.className))],
        detectionCount: record.summary.detectionCount,
        maxSeverity: record.summary.maxSeverity,
        maxConfidence:
          record.detections.length > 0
            ? Math.max(...record.detections.map((d) => d.confidence))
            : 0,
      };
    });
  }
}

export function createMongoRepositories(): Repositories {
  return {
    users: new MongoUserRepository(),
    passwordResets: new MongoPasswordResetRepository(),
    inspections: new MongoInspectionRepository(),
  };
}
