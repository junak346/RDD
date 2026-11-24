/**
 * Core inspection workflow:
 *   validate image → store original → AI inference → store annotated image
 *   → persist inspection (Mongo or labelled demo store) → serve results.
 */
import { config } from '../config';
import { getRepositories } from '../repositories';
import {
  DetectionRecord,
  InspectionLocation,
  InspectionRecord,
  Severity,
} from '../types/domain';
import { errors } from '../utils/errors';
import { sanitizeDisplayName } from '../utils/filenames';
import { logger } from '../utils/logger';

import { AiPrediction, aiClient } from './ai.client';
import { deleteImage, saveImage, writeBase64Image } from './storage.service';

export interface CreateInspectionInput {
  userId: string;
  imageBuffer: Buffer;
  originalName: string;
  claimedMime?: string;
  location?: InspectionLocation;
}

export interface InspectionView {
  id: string;
  userId: string;
  status: string;
  timestamp: string;
  createdAt: string;
  location: InspectionLocation | null;
  model: InspectionRecord['model'];
  processingTimeMs: number;
  aiWarnings: string[];
  detections: DetectionRecord[];
  summary: InspectionRecord['summary'];
  image: {
    url: string;
    originalName?: string;
    mimeType: string;
    size: number;
    width?: number;
    height?: number;
  };
  annotatedImage: { url: string } | null;
  /** Honest labelling for the UI: these results are demo, not real inference. */
  aiDemo: boolean;
}

export function toInspectionView(record: InspectionRecord): InspectionView {
  return {
    id: record.id,
    userId: record.userId,
    status: record.status,
    timestamp: record.timestamp.toISOString(),
    createdAt: record.createdAt.toISOString(),
    location: record.location,
    model: record.model,
    processingTimeMs: record.processingTimeMs,
    aiWarnings: record.aiWarnings,
    detections: record.detections,
    summary: record.summary,
    image: {
      url: `/api/v1/inspections/${record.id}/image?variant=original`,
      originalName: record.image.originalName,
      mimeType: record.image.mimeType,
      size: record.image.size,
      width: record.image.width,
      height: record.image.height,
    },
    annotatedImage: record.annotatedImage
      ? { url: `/api/v1/inspections/${record.id}/image?variant=annotated` }
      : null,
    aiDemo: record.model.demo,
  };
}

function buildSummary(prediction: AiPrediction): InspectionRecord['summary'] {
  return {
    detectionCount: prediction.summary.detectionCount,
    countsByClass: prediction.summary.countsByClass,
    countsBySeverity: prediction.summary.countsBySeverity,
    maxSeverity: prediction.summary.maxSeverity,
  };
}

export const inspectionService = {
  async create(input: CreateInspectionInput): Promise<InspectionView> {
    const repos = getRepositories();

    // 1. Validate + store the original image (content-sniffed, safe name).
    const stored = await saveImage(input.imageBuffer, input.claimedMime);

    let prediction: AiPrediction;
    try {
      // 2. Ask the AI service for real analysis (never fabricated here).
      prediction = await aiClient.predict(input.imageBuffer, stored.filename, stored.mimeType);
    } catch (error) {
      // Clean up the stored original — no partial records are persisted.
      await deleteImage(stored.filename);
      throw error;
    }

    // 3. Store the annotated image when the AI service produced one.
    let annotated;
    if (prediction.annotatedImageBase64) {
      try {
        const saved = await writeBase64Image(prediction.annotatedImageBase64, 'image/jpeg');
        annotated = {
          filename: saved.filename,
          mimeType: saved.mimeType,
          size: saved.size,
        };
      } catch (error) {
        logger.warn({ err: error }, 'failed to persist annotated image — continuing');
      }
    }

    // 4. Persist the inspection record.
    const record = await repos.inspections.create({
      userId: input.userId,
      image: {
        filename: stored.filename,
        originalName: sanitizeDisplayName(input.originalName),
        mimeType: stored.mimeType,
        size: stored.size,
        width: prediction.image.width,
        height: prediction.image.height,
      },
      annotatedImage: annotated,
      timestamp: new Date(),
      location: input.location ?? null,
      status: 'completed',
      model: prediction.model,
      processingTimeMs: prediction.processingTimeMs,
      aiWarnings: prediction.warnings,
      detections: prediction.detections,
      summary: buildSummary(prediction),
    });

    logger.info(
      {
        inspectionId: record.id,
        userId: input.userId,
        detections: record.summary.detectionCount,
        aiDemo: prediction.demo,
      },
      'inspection completed',
    );

    return toInspectionView(record);
  },

  async get(id: string, userId: string, isAdmin: boolean): Promise<InspectionView> {
    const repos = getRepositories();
    const record = await repos.inspections.findById(id);
    if (!record) throw errors.notFound('Inspection not found.');
    if (record.userId !== userId && !isAdmin) throw errors.forbidden();
    return toInspectionView(record);
  },

  async list(query: {
    userId: string;
    isAdmin: boolean;
    search?: string;
    damageType?: string;
    severity?: Severity;
    from?: Date;
    to?: Date;
    sort?: 'createdAt_desc' | 'createdAt_asc' | 'detections_desc';
    page: number;
    limit: number;
  }) {
    const repos = getRepositories();
    const result = await repos.inspections.list({
      ...query,
      // Admins see everything; regular users see only their own inspections.
      userId: query.isAdmin ? undefined : query.userId,
    });
    return {
      items: result.items.map(toInspectionView),
      pagination: { page: result.page, limit: result.limit, total: result.total },
    };
  },

  async remove(id: string, userId: string, isAdmin: boolean): Promise<void> {
    const repos = getRepositories();
    const record = await repos.inspections.findById(id);
    if (!record) throw errors.notFound('Inspection not found.');
    if (record.userId !== userId && !isAdmin) throw errors.forbidden();

    await repos.inspections.delete(id);
    await deleteImage(record.image.filename);
    if (record.annotatedImage) await deleteImage(record.annotatedImage.filename);
    logger.info({ inspectionId: id, userId }, 'inspection deleted');
  },

  async setLocation(
    id: string,
    userId: string,
    isAdmin: boolean,
    location: InspectionLocation,
  ): Promise<InspectionView> {
    const repos = getRepositories();
    const record = await repos.inspections.findById(id);
    if (!record) throw errors.notFound('Inspection not found.');
    if (record.userId !== userId && !isAdmin) throw errors.forbidden();

    const updated = await repos.inspections.updateLocation(id, location);
    if (!updated) throw errors.notFound('Inspection not found.');
    return toInspectionView(updated);
  },

  async recent(userId: string, limit = 5): Promise<InspectionView[]> {
    const repos = getRepositories();
    const items = await repos.inspections.recentForUser(userId, limit);
    return items.map(toInspectionView);
  },
};

export async function getImageBuffer(
  id: string,
  userId: string,
  isAdmin: boolean,
  variant: 'original' | 'annotated',
): Promise<{ buffer: Buffer; mimeType: string }> {
  const repos = getRepositories();
  const record = await repos.inspections.findById(id);
  if (!record) throw errors.notFound('Inspection not found.');
  if (record.userId !== userId && !isAdmin) throw errors.forbidden();

  const ref = variant === 'annotated' ? record.annotatedImage : record.image;
  if (!ref) throw errors.notFound('The requested image variant was not found.');

  const { readImage } = await import('./storage.service');
  const buffer = await readImage(ref.filename);
  return { buffer, mimeType: ref.mimeType };
}

export function dataModeLabel(): 'mongo' | 'demo' {
  return config.isDemoData ? 'demo' : 'mongo';
}
