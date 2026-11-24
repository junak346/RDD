import { InferSchemaType, Schema, model } from 'mongoose';

export const SEVERITIES = ['low', 'moderate', 'high'] as const;

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

const locationSchema = new Schema(
  {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    address: { type: String, maxlength: 240 },
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

const inspectionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    image: { type: fileRefSchema, required: true },
    annotatedImage: { type: fileRefSchema },
    timestamp: { type: Date, default: Date.now },
    location: { type: locationSchema, default: null },
    status: {
      type: String,
      enum: ['completed', 'failed'],
      default: 'completed',
    },
    model: { type: modelInfoSchema, required: true },
    processingTimeMs: { type: Number, required: true },
    aiWarnings: { type: [String], default: [] },
    detections: { type: [detectionSchema], default: [] },
    summary: { type: summarySchema, required: true },
  },
  { timestamps: true },
);

// Frequently queried fields (see docs/ARCHITECTURE.md — indexing strategy).
inspectionSchema.index({ userId: 1, createdAt: -1 });
inspectionSchema.index({ createdAt: -1 });
inspectionSchema.index({ 'detections.className': 1 });
inspectionSchema.index({ 'detections.severity': 1 });
inspectionSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });

export type InspectionDocument = InferSchemaType<typeof inspectionSchema> & { _id: unknown };

export const InspectionModel = model('Inspection', inspectionSchema);
