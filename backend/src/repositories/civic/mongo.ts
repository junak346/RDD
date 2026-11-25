/**
 * MongoDB implementation of the civic repository. Only server-generated IDs
 * and validated GeoJSON locations reach this layer from services.
 */
import crypto from 'crypto';

import { FilterQuery } from 'mongoose';

import {
  AuditLogModel,
  DepartmentModel,
  IncidentModel,
  OfficialModel,
  RoadReportModel,
  SystemSettingModel,
} from '../../models/Civic';
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

/* Mongoose lean() yields a loose document; this is the single normalisation
   boundary between persistence types and the typed domain. */
/* eslint-disable @typescript-eslint/no-explicit-any */
function normalize(value: any): any {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (value instanceof Map) {
    return Object.fromEntries([...value.entries()].map(([key, item]) => [key, normalize(item)]));
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object' && value._bsontype && typeof value.toString === 'function') {
    return value.toString();
  }
  if (typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === '__v') continue;
      if (key === '_id') result.id = String(item);
      else result[key] = normalize(item);
    }
    return result;
  }
  return value;
}

function toRecord<T>(doc: unknown): T {
  return normalize(doc) as T;
}

function withLastUpdated(record: RoadReportRecord): RoadReportRecord {
  return { ...record, lastUpdatedAt: record.updatedAt ?? record.createdAt };
}

function primaryDamageType(report: RoadReportRecord): string | null {
  const counts = report.aiAnalysis?.summary.countsByClass ?? {};
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function maxConfidence(report: RoadReportRecord): number | null {
  const detections = report.aiAnalysis?.detections ?? [];
  return detections.length ? Math.max(...detections.map((item) => item.confidence)) : null;
}

function severityRank(value: Severity | null): number {
  return value ? SEVERITY_RANK[value] : -1;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class MongoCivicRepository implements ICivicRepository {
  async createOfficial(input: NewOfficialInput): Promise<OfficialRecord> {
    const doc = await OfficialModel.create(input);
    return toRecord<OfficialRecord>({ ...doc.toObject(), passwordHash: input.passwordHash });
  }

  async findOfficialByEmail(email: string): Promise<OfficialRecord | null> {
    const doc = await OfficialModel.findOne({ email: email.trim().toLowerCase() })
      .select('+passwordHash')
      .lean();
    return doc ? toRecord<OfficialRecord>(doc) : null;
  }

  async findOfficialById(id: string): Promise<OfficialRecord | null> {
    if (!/^[a-fA-F0-9]{24}$/.test(id)) return null;
    const doc = await OfficialModel.findById(id).select('+passwordHash').lean();
    return doc ? toRecord<OfficialRecord>(doc) : null;
  }

  async updateOfficial(id: string, patch: Partial<OfficialRecord>): Promise<OfficialRecord | null> {
    if (!/^[a-fA-F0-9]{24}$/.test(id)) return null;
    const doc = await OfficialModel.findByIdAndUpdate(id, { $set: patch }, { new: true })
      .select('+passwordHash')
      .lean();
    return doc ? toRecord<OfficialRecord>(doc) : null;
  }

  async listOfficials(): Promise<OfficialRecord[]> {
    const docs = await OfficialModel.find().sort({ createdAt: -1 }).lean();
    return docs.map((doc) => toRecord<OfficialRecord>(doc));
  }

  async createDepartment(input: NewDepartmentInput): Promise<DepartmentRecord> {
    const doc = await DepartmentModel.create(input);
    return toRecord<DepartmentRecord>(doc.toObject());
  }

  async findDepartmentById(id: string): Promise<DepartmentRecord | null> {
    if (!/^[a-fA-F0-9]{24}$/.test(id) && !id.startsWith('dept_')) return null;
    if (!/^[a-fA-F0-9]{24}$/.test(id)) return null;
    const doc = await DepartmentModel.findById(id).lean();
    return doc ? toRecord<DepartmentRecord>(doc) : null;
  }

  async findDepartmentByName(name: string): Promise<DepartmentRecord | null> {
    const doc = await DepartmentModel.findOne({
      name: { $regex: `^${escapeRegExp(name.trim())}$`, $options: 'i' },
    }).lean();
    return doc ? toRecord<DepartmentRecord>(doc) : null;
  }

  async updateDepartment(
    id: string,
    patch: Partial<DepartmentRecord>,
  ): Promise<DepartmentRecord | null> {
    if (!/^[a-fA-F0-9]{24}$/.test(id)) return null;
    const doc = await DepartmentModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    return doc ? toRecord<DepartmentRecord>(doc) : null;
  }

  async listDepartments(activeOnly = false): Promise<DepartmentRecord[]> {
    const docs = await DepartmentModel.find(activeOnly ? { active: true } : {})
      .sort({ name: 1 })
      .lean();
    return docs.map((doc) => toRecord<DepartmentRecord>(doc));
  }

  async createReport(input: NewRoadReportInput): Promise<RoadReportRecord> {
    const doc = await RoadReportModel.create(input);
    return withLastUpdated(toRecord<RoadReportRecord>(doc.toObject()));
  }

  async findReportById(id: string): Promise<RoadReportRecord | null> {
    if (!/^[a-fA-F0-9]{24}$/.test(id) && !id.startsWith('report_')) return null;
    if (!/^[a-fA-F0-9]{24}$/.test(id)) return null;
    const doc = await RoadReportModel.findById(id).lean();
    return doc ? withLastUpdated(toRecord<RoadReportRecord>(doc)) : null;
  }

  async findReportByPublicIdHash(hash: string): Promise<RoadReportRecord | null> {
    const doc = await RoadReportModel.findOne({ publicIdHash: hash }).lean();
    return doc ? withLastUpdated(toRecord<RoadReportRecord>(doc)) : null;
  }

  async updateReport(
    id: string,
    patch: Partial<RoadReportRecord>,
  ): Promise<RoadReportRecord | null> {
    const cleanPatch = { ...patch } as Record<string, unknown>;
    delete cleanPatch.id;
    delete cleanPatch.createdAt;
    delete cleanPatch.updatedAt;
    delete cleanPatch.lastUpdatedAt;
    const doc = await RoadReportModel.findByIdAndUpdate(
      id,
      { $set: cleanPatch },
      { new: true, runValidators: true },
    ).lean();
    return doc ? withLastUpdated(toRecord<RoadReportRecord>(doc)) : null;
  }

  async appendReportAudit(id: string, event: AuditEvent): Promise<RoadReportRecord | null> {
    const doc = await RoadReportModel.findByIdAndUpdate(
      id,
      { $push: { auditHistory: event }, $set: { updatedAt: event.timestamp } },
      { new: true },
    ).lean();
    return doc ? withLastUpdated(toRecord<RoadReportRecord>(doc)) : null;
  }

  async listReports(query: ReportListQuery): Promise<Paged<RoadReportRecord>> {
    const filter: Record<string, unknown> = { archived: { $ne: true } };
    if (query.search) {
      const regex = { $regex: escapeRegExp(query.search), $options: 'i' };
      filter.$or = [
        { publicReportId: regex },
        { status: regex },
        { priority: regex },
        { departmentName: regex },
        { assignedOfficialName: regex },
        { incidentPublicId: regex },
      ];
    }
    if (query.status) filter.status = query.status;
    if (query.severity) filter.aiSeverity = query.severity;
    if (query.priority) filter.priority = query.priority;
    if (query.departmentId) filter.departmentId = query.departmentId;
    if (query.assignedOfficialId) filter.assignedOfficialId = query.assignedOfficialId;
    if (query.damageType) {
      filter[`aiAnalysis.summary.countsByClass.${query.damageType}`] = { $gt: 0 };
    }
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      };
    }
    if (query.overdueOnly) {
      filter.dueAt = { $lt: new Date() };
      filter.status = { $nin: ['RESOLVED', 'CLOSED', 'REJECTED'] };
    }
    const sort: Record<string, 1 | -1> =
      query.sort === 'createdAt_asc'
        ? { createdAt: 1 }
        : query.sort === 'severity_desc' || query.sort === 'priority_desc'
          ? { createdAt: -1 }
          : { createdAt: -1 };

    const docs = await RoadReportModel.find(filter as FilterQuery<any>)
      .sort(sort)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean();
    const items = docs.map((doc) => withLastUpdated(toRecord<RoadReportRecord>(doc)));
    // Severity/priority are low-cardinality administrative labels; sorting in
    // the service layer keeps Mongo and memory behaviour identical.
    if (query.sort === 'severity_desc') {
      items.sort((a, b) => severityRank(b.aiSeverity) - severityRank(a.aiSeverity));
    } else if (query.sort === 'priority_desc') {
      const rank = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
      items.sort((a, b) => rank[b.priority] - rank[a.priority]);
    }
    const total = await RoadReportModel.countDocuments(filter as FilterQuery<any>);
    return { items, total, page: query.page, limit: query.limit };
  }

  async allReports(): Promise<RoadReportRecord[]> {
    const docs = await RoadReportModel.find({}).sort({ createdAt: -1 }).lean();
    return docs.map((doc) => withLastUpdated(toRecord<RoadReportRecord>(doc)));
  }

  async findNearbyReports(query: NearbyReportQuery): Promise<RoadReportRecord[]> {
    const docs = await RoadReportModel.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [query.longitude, query.latitude],
          },
          $maxDistance: query.radiusMeters,
        },
      },
      createdAt: { $gte: query.since },
      archived: { $ne: true },
    })
      .limit(100)
      .lean();
    let items = docs.map((doc) => withLastUpdated(toRecord<RoadReportRecord>(doc)));
    // Re-check exact distance (GeoJSON $near uses spherical geometry too).
    items = items.filter(
      (report) =>
        distanceMeters(
          query.latitude,
          query.longitude,
          report.location.latitude,
          report.location.longitude,
        ) <= query.radiusMeters,
    );
    if (query.damageType) {
      items = items.filter((report) =>
        Object.keys(report.aiAnalysis?.summary.countsByClass ?? {}).includes(query.damageType!),
      );
    }
    return items;
  }

  async mapReports(): Promise<CivicMapReport[]> {
    const reports = await this.allReports();
    return reports
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
    const doc = await IncidentModel.create(input);
    return toRecord<IncidentRecord>(doc.toObject());
  }

  async findIncidentById(id: string): Promise<IncidentRecord | null> {
    if (!/^[a-fA-F0-9]{24}$/.test(id) && !id.startsWith('incident_')) return null;
    if (!/^[a-fA-F0-9]{24}$/.test(id)) return null;
    const doc = await IncidentModel.findById(id).lean();
    return doc ? toRecord<IncidentRecord>(doc) : null;
  }

  async updateIncident(id: string, patch: Partial<IncidentRecord>): Promise<IncidentRecord | null> {
    const cleanPatch = { ...patch } as Record<string, unknown>;
    delete cleanPatch.id;
    delete cleanPatch.createdAt;
    delete cleanPatch.updatedAt;
    const doc = await IncidentModel.findByIdAndUpdate(id, { $set: cleanPatch }, { new: true }).lean();
    return doc ? toRecord<IncidentRecord>(doc) : null;
  }

  async listIncidents(): Promise<IncidentRecord[]> {
    const docs = await IncidentModel.find().sort({ createdAt: -1 }).lean();
    return docs.map((doc) => toRecord<IncidentRecord>(doc));
  }

  async appendAudit(input: NewAuditLogInput): Promise<AuditLogRecord> {
    const record = {
      ...input,
      id: input.id ?? `audit_${crypto.randomUUID()}`,
      timestamp: input.timestamp ?? new Date(),
      immutable: true,
    };
    const doc = await AuditLogModel.create(record);
    return toRecord<AuditLogRecord>(doc.toObject());
  }

  async listAuditLogs(reportId?: string, limit = 200): Promise<AuditLogRecord[]> {
    const docs = await AuditLogModel.find(reportId ? { reportId } : {})
      .sort({ timestamp: -1 })
      .limit(Math.min(Math.max(limit, 1), 500))
      .lean();
    return docs.map((doc) => toRecord<AuditLogRecord>(doc));
  }

  async getSetting(key: string): Promise<SystemSettingRecord | null> {
    const doc = await SystemSettingModel.findOne({ key }).lean();
    return doc ? toRecord<SystemSettingRecord>(doc) : null;
  }

  async setSetting(key: string, value: unknown, updatedBy?: string): Promise<SystemSettingRecord> {
    const doc = await SystemSettingModel.findOneAndUpdate(
      { key },
      { $set: { value, updatedAt: new Date(), updatedBy } },
      { new: true, upsert: true },
    ).lean();
    return toRecord<SystemSettingRecord>(doc);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
