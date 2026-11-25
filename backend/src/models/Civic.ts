import { Schema, model } from 'mongoose';

import {
  OFFICIAL_ROLES,
  PRIORITIES,
  REPORT_STATUSES,
} from '../types/civic';
import { SEVERITIES } from './Inspection';

const bboxSchema = new Schema(
  {
    x1: { type: Number, required: true },
    y1: { type: Number, required: true },
    x2: { type: Number, required: true },
    y2: { type: Number, required: true },
  },
  { _id: false },
);

const detectionSchema = new Schema(
  {
    classId: { type: Number, required: true },
    className: { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    severity: { type: String, enum: SEVERITIES, required: true },
    severityScore: { type: Number, required: true, min: 0, max: 1 },
    areaRatio: { type: Number, required: true, min: 0, max: 1 },
    bbox: { type: bboxSchema, required: true },
  },
  { _id: false },
);

const fileRefSchema = new Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, maxlength: 120 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false },
);

const capturedImageSchema = new Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, maxlength: 120 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number },
    capturedAt: { type: Date, required: true },
    uploadedAt: { type: Date, required: true },
    format: { type: String, required: true },
    sha256: { type: String, required: true },
  },
  { _id: false },
);

const geoPointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: { type: [Number], required: true },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    accuracy: { type: Number, required: true, min: 0 },
    capturedAt: { type: Date, required: true },
  },
  { _id: false },
);

const modelInfoSchema = new Schema(
  {
    name: { type: String, required: true },
    version: { type: String, required: true },
    engine: { type: String, required: true },
    device: { type: String },
    demo: { type: Boolean, required: true },
    confidenceThreshold: { type: Number },
    iouThreshold: { type: Number },
  },
  { _id: false },
);

const summarySchema = new Schema(
  {
    detectionCount: { type: Number, required: true },
    countsByClass: { type: Map, of: Number, default: {} },
    countsBySeverity: { type: Map, of: Number, default: {} },
    maxSeverity: { type: String, enum: [...SEVERITIES, null], default: null },
  },
  { _id: false },
);

const aiAnalysisSchema = new Schema(
  {
    analysedAt: { type: Date, required: true },
    model: { type: modelInfoSchema, required: true },
    confidenceThreshold: { type: Number, required: true },
    processingTimeMs: { type: Number, required: true },
    detections: { type: [detectionSchema], default: [] },
    summary: { type: summarySchema, required: true },
    warnings: { type: [String], default: [] },
    annotatedImage: { type: fileRefSchema },
    demo: { type: Boolean, required: true },
    noDamageDetected: { type: Boolean, required: true },
  },
  { _id: false },
);

const noteSchema = new Schema(
  {
    id: { type: String, required: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    text: { type: String, required: true, maxlength: 4000 },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const auditEventSchema = new Schema(
  {
    id: { type: String, required: true },
    actor: { type: String, required: true },
    actorId: { type: String },
    role: { type: String, required: true },
    action: { type: String, required: true },
    timestamp: { type: Date, required: true },
    reportId: { type: String },
    reportPublicId: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const roadReportSchema = new Schema(
  {
    publicReportId: { type: String, required: true, unique: true },
    publicIdHash: { type: String, required: true, unique: true },
    citizenAccessTokenHash: { type: String, required: true, unique: true },
    image: { type: capturedImageSchema, required: true },
    annotatedImage: { type: fileRefSchema },
    imageHash: { type: String, required: true },
    location: { type: geoPointSchema, required: true },
    submittedAt: { type: Date, required: true },
    aiAnalysis: { type: aiAnalysisSchema, default: null },
    aiSeverity: { type: String, enum: [...SEVERITIES, null], default: null },
    noDamageDetected: { type: Boolean, default: false },
    priority: { type: String, enum: PRIORITIES, default: 'LOW', required: true },
    status: { type: String, enum: REPORT_STATUSES, default: 'SUBMITTED', required: true },
    incidentId: { type: String, default: null },
    incidentPublicId: { type: String, default: null },
    incidentReportCount: { type: Number, default: 1 },
    departmentId: { type: String, default: null },
    departmentName: { type: String, default: null },
    assignedOfficialId: { type: String, default: null },
    assignedOfficialName: { type: String, default: null },
    dueAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    internalNotes: { type: [noteSchema], default: [] },
    auditHistory: { type: [auditEventSchema], default: [] },
    suspicious: { type: Boolean, default: false },
    sourceIpHash: { type: String, default: null },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

roadReportSchema.index({ location: '2dsphere' });
roadReportSchema.index({ status: 1, createdAt: -1 });
roadReportSchema.index({ aiSeverity: 1, createdAt: -1 });
roadReportSchema.index({ priority: 1, dueAt: 1 });
roadReportSchema.index({ departmentId: 1, assignedOfficialId: 1 });
roadReportSchema.index({ incidentId: 1, createdAt: -1 });
roadReportSchema.index({ 'image.sha256': 1, createdAt: -1 });
// `timestamps: true` stores this as updatedAt; the repository maps it to the
// domain record's lastUpdatedAt. Index the actual persisted field.
roadReportSchema.index({ updatedAt: -1 });

const incidentSchema = new Schema(
  {
    publicIncidentId: { type: String, required: true, unique: true },
    reportIds: { type: [String], default: [] },
    reportCount: { type: Number, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point', required: true },
      coordinates: { type: [Number], required: true },
    },
    primaryDamageType: { type: String, default: null },
    maxSeverity: { type: String, enum: [...SEVERITIES, null], default: null },
    status: { type: String, enum: REPORT_STATUSES, default: 'AI_ANALYSED' },
  },
  { timestamps: true },
);
incidentSchema.index({ location: '2dsphere' });
incidentSchema.index({ createdAt: -1 });

const officialSchema = new Schema(
  {
    officialId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    department: { type: String, required: true, maxlength: 120 },
    designation: { type: String, required: true, maxlength: 120 },
    role: { type: String, enum: OFFICIAL_ROLES, required: true },
    passwordHash: { type: String, required: true, select: false },
    accountStatus: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    sessionVersion: { type: Number, default: 1 },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);
officialSchema.index({ role: 1, accountStatus: 1 });

const departmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 24 },
    description: { type: String, default: '', maxlength: 500 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const auditLogSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    actor: { type: String, required: true },
    actorId: { type: String },
    role: { type: String, required: true },
    action: { type: String, required: true },
    timestamp: { type: Date, required: true },
    reportId: { type: String },
    reportPublicId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    immutable: { type: Boolean, default: true },
  },
  { timestamps: false },
);
auditLogSchema.index({ reportId: 1, timestamp: 1 });
auditLogSchema.index({ timestamp: -1 });

const systemSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, required: true },
    updatedBy: { type: String },
  },
  { timestamps: false },
);

export const RoadReportModel = model('RoadReport', roadReportSchema);
export const IncidentModel = model('Incident', incidentSchema);
export const OfficialModel = model('Official', officialSchema);
export const DepartmentModel = model('Department', departmentSchema);
export const AuditLogModel = model('AuditLog', auditLogSchema);
export const SystemSettingModel = model('SystemSetting', systemSettingSchema);
