/**
 * Anonymous citizen reporting workflow:
 *   validated camera image + browser GPS → protected storage → existing AI
 *   service → stored lifecycle report → unguessable public capability ID.
 *
 * No personally identifying citizen fields are collected. AI failures preserve
 * the submission in a clearly pending state; they never fabricate detections.
 */
import crypto from 'crypto';

import { config } from '../config';
import { getCivicRepository, ICivicRepository } from '../repositories/civic';
import {
  AuditEvent,
  RoadReportAiAnalysis,
  RoadReportRecord,
  Severity,
} from '../types/civic';
import { CapturedLocationInput } from '../validators/civic.validators';
import { errors } from '../utils/errors';
import {
  auditEvent,
  buildDetectionSummary,
  generatePublicIncidentId,
  generatePublicReportId,
  hashCitizenAccessToken,
  hashClientIp,
  hashPublicReportId,
  normalizePublicReportId,
  sha256,
  toPublicReportDto,
} from '../utils/civic';
import { logger } from '../utils/logger';
import { sanitizeDisplayName } from '../utils/filenames';

import { abuseGuard } from './abuseGuard';
import { AiPrediction, aiClient } from './ai.client';
import { publishDomainEvent } from './domainEvents';
import { getReportImageStorage } from './reportStorage';
import { getCivicSystemSettings } from './systemSettings.service';

export interface CreateCitizenReportInput {
  imageBuffer: Buffer;
  originalName: string;
  claimedMime?: string;
  location: CapturedLocationInput;
  ip?: string;
}

export interface CitizenReportResult {
  report: RoadReportRecord;
  publicReport: ReturnType<typeof toPublicReportDto>;
}

const SEVERITY_RANK: Record<Severity, number> = { low: 0, moderate: 1, high: 2 };

function primaryDamageType(report: RoadReportRecord): string | null {
  const counts = report.aiAnalysis?.summary.countsByClass ?? {};
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function maxSeverity(reports: RoadReportRecord[]): Severity | null {
  let result: Severity | null = null;
  for (const report of reports) {
    if (report.aiSeverity && (!result || SEVERITY_RANK[report.aiSeverity] > SEVERITY_RANK[result])) {
      result = report.aiSeverity;
    }
  }
  return result;
}

async function recordReportAudit(
  repo: ICivicRepository,
  report: RoadReportRecord,
  action: string,
  actor: string,
  role: string,
  metadata?: Record<string, unknown>,
  actorId?: string,
): Promise<RoadReportRecord> {
  const event: AuditEvent = auditEvent({
    actor,
    actorId,
    role,
    action,
    reportId: report.id,
    reportPublicId: report.publicReportId,
    metadata,
  });
  await repo.appendAudit({ ...event });
  return (await repo.appendReportAudit(report.id, event)) ?? report;
}

async function storeAnnotatedImage(prediction: AiPrediction): Promise<RoadReportRecord['annotatedImage']> {
  if (!prediction.annotatedImageBase64) return undefined;
  try {
    const buffer = Buffer.from(prediction.annotatedImageBase64, 'base64');
    const stored = await getReportImageStorage().save(buffer, 'image/jpeg');
    return { filename: stored.filename, mimeType: stored.mimeType, size: stored.size };
  } catch (error) {
    logger.warn({ err: error }, 'could not persist annotated citizen-report image');
    return undefined;
  }
}

function applyConfidenceGate(prediction: AiPrediction, adminThreshold: number): {
  detections: AiPrediction['detections'];
  summary: RoadReportAiAnalysis['summary'];
  warnings: string[];
  threshold: number;
} {
  // MODEL_CONFIDENCE_THRESHOLD is the non-negotiable baseline. An administrator
  // may raise the backend gate; the AI service also reports its own threshold.
  const effectiveThreshold = Math.max(
    config.modelConfidenceThreshold,
    adminThreshold,
    prediction.model.confidenceThreshold ?? 0,
  );
  const detections = prediction.detections.filter(
    (detection) => detection.confidence >= effectiveThreshold,
  );
  const warnings = [...prediction.warnings];
  if (detections.length !== prediction.detections.length) {
    warnings.push(
      `${prediction.detections.length - detections.length} low-confidence detection(s) were excluded by the configured model threshold.`,
    );
  }
  if (detections.length === 0) warnings.push('No road damage detected.');
  return {
    detections,
    summary: buildDetectionSummary(detections),
    warnings,
    threshold: effectiveThreshold,
  };
}

async function groupLikelyDuplicate(
  repo: ICivicRepository,
  report: RoadReportRecord,
): Promise<RoadReportRecord> {
  const damageType = primaryDamageType(report);
  if (!damageType || report.noDamageDetected) return report;

  const settings = await getCivicSystemSettings(repo);
  const since = new Date(
    report.createdAt.getTime() - settings.duplicateWindowHours * 60 * 60 * 1000,
  );
  const nearby = (
    await repo.findNearbyReports({
      latitude: report.location.latitude,
      longitude: report.location.longitude,
      radiusMeters: settings.duplicateRadiusMeters,
      since,
      damageType,
    })
  ).filter((candidate) => candidate.id !== report.id && candidate.aiAnalysis);

  if (nearby.length === 0) return report;

  const existing = nearby.find((candidate) => candidate.incidentId);
  let incident = existing?.incidentId ? await repo.findIncidentById(existing.incidentId) : null;
  const involvedIds = new Set<string>([
    report.id,
    ...nearby.map((candidate) => candidate.id),
    ...(incident?.reportIds ?? []),
  ]);

  if (!incident) {
    const reports = [report, ...nearby];
    const longitude =
      reports.reduce((sum, item) => sum + item.location.longitude, 0) / reports.length;
    const latitude =
      reports.reduce((sum, item) => sum + item.location.latitude, 0) / reports.length;
    incident = await repo.createIncident({
      publicIncidentId: generatePublicIncidentId(),
      reportIds: [...involvedIds],
      reportCount: involvedIds.size,
      location: { type: 'Point', coordinates: [longitude, latitude] },
      primaryDamageType: damageType,
      maxSeverity: maxSeverity(reports),
      status: 'AI_ANALYSED',
    });
  } else {
    const involved = (
      await Promise.all([...involvedIds].map((id) => repo.findReportById(id)))
    ).filter((item): item is RoadReportRecord => Boolean(item));
    incident = await repo.updateIncident(incident.id, {
      reportIds: [...involvedIds],
      reportCount: involvedIds.size,
      primaryDamageType: damageType,
      maxSeverity: maxSeverity(involved) ?? incident.maxSeverity,
    });
  }

  if (!incident) return report;

  let updated = report;
  for (const id of involvedIds) {
    const patch = {
      incidentId: incident.id,
      incidentPublicId: incident.publicIncidentId,
      incidentReportCount: incident.reportCount,
    };
    const result = await repo.updateReport(id, patch);
    if (id === report.id && result) updated = result;
  }

  await repo.appendAudit({
    actor: 'SYSTEM',
    role: 'SYSTEM',
    action: 'REPORTS_GROUPED_INCIDENT',
    timestamp: new Date(),
    reportId: report.id,
    reportPublicId: report.publicReportId,
    metadata: {
      incidentPublicId: incident.publicIncidentId,
      reportCount: incident.reportCount,
      criterion: 'GPS proximity + time window + damage type',
    },
  });
  publishDomainEvent('REPORT_GROUPED', {
    incidentPublicId: incident.publicIncidentId,
    reportCount: incident.reportCount,
    damageType,
  });
  return updated;
}

export const civicReportService = {
  async create(input: CreateCitizenReportInput): Promise<CitizenReportResult> {
    const repo = getCivicRepository();
    const storage = getReportImageStorage();
    const settings = await getCivicSystemSettings(repo);
    const now = new Date();
    const imageHash = sha256(input.imageBuffer);
    const sourceIpHash = hashClientIp(input.ip);

    const abuse = abuseGuard.check(
      sourceIpHash,
      imageHash,
      input.location.latitude,
      input.location.longitude,
      now.getTime(),
    );

    const stored = await storage.save(input.imageBuffer, input.claimedMime);
    const publicReportId = generatePublicReportId(now);
    const capturedAt = input.location.capturedAt;

    let report: RoadReportRecord;
    try {
      report = await repo.createReport({
        publicReportId,
        publicIdHash: hashPublicReportId(publicReportId),
        citizenAccessTokenHash: hashCitizenAccessToken(publicReportId),
        image: {
          filename: stored.filename,
          originalName: sanitizeDisplayName(input.originalName || 'camera-capture.jpg'),
          mimeType: stored.mimeType,
          size: stored.size,
          capturedAt,
          uploadedAt: now,
          format: stored.mimeType.replace('image/', ''),
          sha256: imageHash,
        },
        imageHash,
        location: {
          type: 'Point',
          coordinates: [input.location.longitude, input.location.latitude],
          latitude: input.location.latitude,
          longitude: input.location.longitude,
          accuracy: input.location.accuracy,
          capturedAt,
        },
        submittedAt: now,
        aiAnalysis: null,
        aiSeverity: null,
        noDamageDetected: false,
        priority: 'LOW',
        status: 'SUBMITTED',
        incidentId: null,
        incidentPublicId: null,
        incidentReportCount: 1,
        departmentId: null,
        departmentName: null,
        assignedOfficialId: null,
        assignedOfficialName: null,
        dueAt: null,
        resolvedAt: null,
        closedAt: null,
        internalNotes: [],
        auditHistory: [],
        suspicious: abuse.suspicious,
        sourceIpHash,
        archived: false,
        createdAt: now,
        updatedAt: now,
        lastUpdatedAt: now,
      });
    } catch (error) {
      await storage.remove(stored.filename);
      throw error;
    }

    abuseGuard.record(
      sourceIpHash,
      imageHash,
      input.location.latitude,
      input.location.longitude,
      now.getTime(),
    );
    await repo.appendAudit({
      actor: 'CITIZEN',
      role: 'ANONYMOUS_PUBLIC',
      action: 'REPORT_SUBMITTED',
      timestamp: now,
      reportId: report.id,
      reportPublicId: report.publicReportId,
      metadata: { locationAccuracy: input.location.accuracy, suspicious: abuse.suspicious },
    });
    publishDomainEvent('PUBLIC_REPORT_CREATED', {
      publicReportId,
      reportId: report.id,
      suspicious: abuse.suspicious,
    });
    logger.info(
      { publicReportId, reportId: report.id, suspicious: abuse.suspicious, imageBytes: stored.size },
      'anonymous road report created',
    );

    report = await repo.updateReport(report.id, { status: 'AI_ANALYSIS' }) ?? report;
    report = await recordReportAudit(
      repo,
      report,
      'AI_ANALYSIS_STARTED',
      'SYSTEM',
      'SYSTEM',
      {
        modelThresholdBaseline: config.modelConfidenceThreshold,
        modelThresholdAdministrative: settings.modelConfiguration.confidenceThreshold,
      },
    );

    let prediction: AiPrediction;
    try {
      prediction = await aiClient.predict(
        input.imageBuffer,
        stored.filename,
        stored.mimeType,
      );
    } catch (error) {
      // Preserve the citizen submission honestly; never invent an AI result.
      const reason = error instanceof Error ? error.message : 'unknown';
      logger.warn({ reportId: report.id, publicReportId, reason }, 'AI analysis unavailable for citizen report');
      report = await repo.updateReport(report.id, { status: 'SUBMITTED' }) ?? report;
      report = await recordReportAudit(
        repo,
        report,
        'AI_ANALYSIS_UNAVAILABLE',
        'SYSTEM',
        'SYSTEM',
        { reason: 'AI service unavailable', demo: false },
      );
      publishDomainEvent('AI_ANALYSIS_UNAVAILABLE', { publicReportId, reportId: report.id });
      return { report, publicReport: toPublicReportDto(report) };
    }

    const gated = applyConfidenceGate(
      prediction,
      settings.modelConfiguration.confidenceThreshold,
    );
    const annotatedImage = await storeAnnotatedImage(prediction);
    const demo = Boolean(prediction.demo || prediction.model.demo);
    const warnings = [...gated.warnings];
    if (demo && !warnings.some((warning) => warning.includes('DEMO MODE'))) {
      warnings.push('DEMO MODE: heuristic engine — not trained model inference.');
    }
    const aiAnalysis: RoadReportAiAnalysis = {
      analysedAt: new Date(),
      model: prediction.model,
      confidenceThreshold: gated.threshold,
      processingTimeMs: prediction.processingTimeMs,
      detections: gated.detections,
      summary: gated.summary,
      warnings,
      annotatedImage,
      demo,
      noDamageDetected: gated.detections.length === 0,
    };

    report = await repo.updateReport(report.id, {
      image: {
        ...report.image,
        width: prediction.image.width,
        height: prediction.image.height,
        format: prediction.image.format,
      },
      annotatedImage,
      aiAnalysis,
      aiSeverity: gated.summary.maxSeverity,
      noDamageDetected: aiAnalysis.noDamageDetected,
      status: 'AI_ANALYSED',
    }) ?? report;

    report = await recordReportAudit(
      repo,
      report,
      'AI_ANALYSIS_COMPLETED',
      'AI_SERVICE',
      'SYSTEM',
      {
        detections: gated.summary.detectionCount,
        demo,
        noDamageDetected: aiAnalysis.noDamageDetected,
        processingTimeMs: prediction.processingTimeMs,
        modelVersion: prediction.model.version,
      },
    );
    publishDomainEvent('AI_ANALYSIS_COMPLETED', {
      publicReportId,
      detections: gated.summary.detectionCount,
      demo,
    });

    report = await groupLikelyDuplicate(repo, report);
    return { report, publicReport: toPublicReportDto(report) };
  },

  async publicStatus(publicId: string): Promise<ReturnType<typeof toPublicReportDto>> {
    const normalized = normalizePublicReportId(publicId);
    const report = await getCivicRepository().findReportByPublicIdHash(
      hashPublicReportId(normalized),
    );
    if (!report || report.archived) {
      throw errors.notFound('No report was found for that ID.');
    }
    return toPublicReportDto(report);
  },

  /** Used only by authorized official endpoints, never by public status. */
  async findById(id: string): Promise<RoadReportRecord> {
    const report = await getCivicRepository().findReportById(id);
    if (!report || report.archived) throw errors.notFound('Report not found.');
    return report;
  },
};

/** Test/utility hook: cryptographically random internal IDs for notes. */
export function newInternalNoteId(): string {
  return crypto.randomUUID();
}
