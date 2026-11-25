import crypto from 'crypto';

import { Request } from 'express';

import { config } from '../config';
import {
  AuditEvent,
  DetectionRecord,
  InspectionSummary,
  RoadReportRecord,
  Severity,
} from '../types/civic';

const PUBLIC_ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32, no ambiguous chars
const SEVERITY_RANK: Record<Severity, number> = { low: 0, moderate: 1, high: 2 };

/** 50 bits of entropy, human-readable, never sequential. Treat as a capability token. */
export function generatePublicReportId(now = new Date()): string {
  let suffix = '';
  for (let index = 0; index < 10; index += 1) {
    suffix += PUBLIC_ID_ALPHABET[crypto.randomInt(0, PUBLIC_ID_ALPHABET.length)];
  }
  return `RVR-${now.getUTCFullYear()}-${suffix}`;
}

export function generatePublicIncidentId(): string {
  let suffix = '';
  for (let index = 0; index < 6; index += 1) {
    suffix += PUBLIC_ID_ALPHABET[crypto.randomInt(0, PUBLIC_ID_ALPHABET.length)];
  }
  return `RV-${suffix}`;
}

export function normalizePublicReportId(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function hashPublicReportId(publicId: string): string {
  return crypto
    .createHmac('sha256', config.hmacSecret)
    .update(normalizePublicReportId(publicId))
    .digest('hex');
}

export function hashCitizenAccessToken(publicId: string): string {
  return crypto
    .createHmac('sha256', config.hmacSecret)
    .update(`citizen-access:${normalizePublicReportId(publicId)}`)
    .digest('hex');
}

export function hashClientIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return crypto.createHmac('sha256', config.hmacSecret).update(`ip:${ip}`).digest('hex');
}

export function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1));
    } catch {
      return part.slice(separator + 1);
    }
  }
  return undefined;
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Parse common jsonwebtoken duration strings for cookie max-age. */
export function durationToMs(value: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/i.exec(value.trim());
  if (!match) return 8 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = (match[2] ?? 'ms').toLowerCase();
  const factor = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 1;
  return Math.round(amount * factor);
}

export function auditEvent(input: Omit<AuditEvent, 'id' | 'timestamp'> & { timestamp?: Date }): AuditEvent {
  return {
    ...input,
    id: crypto.randomUUID(),
    timestamp: input.timestamp ?? new Date(),
  };
}

export function safeTokenEquals(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right || left.length !== right.length) return false;
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

/** Recompute the AI summary after the configured confidence gate is applied. */
export function buildDetectionSummary(detections: DetectionRecord[]): InspectionSummary {
  const countsByClass: Record<string, number> = {};
  const countsBySeverity: Record<string, number> = {};
  for (const detection of detections) {
    countsByClass[detection.className] = (countsByClass[detection.className] ?? 0) + 1;
    countsBySeverity[detection.severity] = (countsBySeverity[detection.severity] ?? 0) + 1;
  }
  let maxSeverity: Severity | null = null;
  for (const detection of detections) {
    if (!maxSeverity || SEVERITY_RANK[detection.severity] > SEVERITY_RANK[maxSeverity]) {
      maxSeverity = detection.severity;
    }
  }
  return { detectionCount: detections.length, countsByClass, countsBySeverity, maxSeverity };
}

/** Coarse, deliberately non-exact public location (about an 0.1° grid). */
export function generalLocation(location: RoadReportRecord['location']): {
  area: string;
  precision: string;
  accuracyMeters: number;
} {
  return {
    area: `Approximate area ${location.latitude.toFixed(1)}°, ${location.longitude.toFixed(1)}°`,
    precision: 'coarse',
    accuracyMeters: Math.round(location.accuracy),
  };
}

export interface PublicReportDto {
  publicReportId: string;
  submittedAt: string;
  lastUpdatedAt: string;
  status: RoadReportRecord['status'];
  generalLocation: ReturnType<typeof generalLocation>;
  detectedDamageType: string | null;
  severity: Severity | null;
  confidence: number | null;
  noDamageDetected: boolean;
  aiPending: boolean;
  aiDemo: boolean;
  timeline: Array<{ key: string; label: string; state: 'complete' | 'current' | 'pending' }>;
  message: string;
}

const PUBLIC_TIMELINE = [
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'AI_ANALYSED', label: 'AI analysed' },
  { key: 'UNDER_REVIEW', label: 'Under review' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'RESOLVED', label: 'Resolved' },
] as const;

/** Strict public DTO: no exact coordinates, image URLs, notes, IP or audit details. */
export function toPublicReportDto(report: RoadReportRecord): PublicReportDto {
  const counts = report.aiAnalysis?.summary.countsByClass ?? {};
  const detectedDamageType =
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const confidence = report.aiAnalysis?.detections.length
    ? Math.max(...report.aiAnalysis.detections.map((detection) => detection.confidence))
    : null;
  const aiPending = !report.aiAnalysis && ['SUBMITTED', 'AI_ANALYSIS'].includes(report.status);
  const statusProgress: Record<RoadReportRecord['status'], number> = {
    SUBMITTED: 0,
    AI_ANALYSIS: 0,
    AI_ANALYSED: 1,
    UNDER_REVIEW: 2,
    VERIFIED: 2,
    REJECTED: 2,
    ASSIGNED: 3,
    IN_PROGRESS: 4,
    RESOLVED: 5,
    CLOSED: 5,
  };
  const currentIndex = statusProgress[report.status];
  const timeline = PUBLIC_TIMELINE.map((entry, index) => ({
    key: entry.key,
    label: entry.label,
    state:
      index < currentIndex
        ? ('complete' as const)
        : index === currentIndex
          ? ('current' as const)
          : ('pending' as const),
  }));
  return {
    publicReportId: report.publicReportId,
    submittedAt: report.submittedAt.toISOString(),
    lastUpdatedAt: report.lastUpdatedAt.toISOString(),
    status: report.status,
    generalLocation: generalLocation(report.location),
    detectedDamageType,
    severity: report.aiSeverity,
    confidence,
    noDamageDetected: report.noDamageDetected,
    aiPending,
    aiDemo: Boolean(report.aiAnalysis?.demo),
    timeline,
    message: report.status === 'REJECTED'
      ? 'This report was reviewed but not verified by an official.'
      : report.status === 'RESOLVED'
        ? 'This report has been marked resolved.'
        : report.status === 'CLOSED'
          ? 'This case is closed.'
          : report.noDamageDetected
            ? 'No road damage detected.'
            : aiPending
              ? 'AI analysis is pending or temporarily unavailable.'
              : detectedDamageType
                ? `AI detected a likely ${detectedDamageType.replace(/_/g, ' ')}.`
                : 'Report received.',
  };
}

export function escapeCsv(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  // Basic spreadsheet-formula injection guard for exported citizen-derived text.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
