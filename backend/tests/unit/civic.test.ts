import { describe, expect, it } from 'vitest';

import { RoadReportRecord } from '../../src/types/civic';
import {
  buildDetectionSummary,
  durationToMs,
  escapeCsv,
  generatePublicReportId,
  hashPublicReportId,
  safeTokenEquals,
  toPublicReportDto,
} from '../../src/utils/civic';
import { createPublicReportSchema } from '../../src/validators/civic.validators';

function report(overrides: Partial<RoadReportRecord> = {}): RoadReportRecord {
  const now = new Date();
  return {
    id: 'report_test',
    publicReportId: 'RVR-2026-ABCDEFGHJK',
    publicIdHash: 'hash',
    citizenAccessTokenHash: 'access',
    image: {
      filename: 'camera.jpg',
      mimeType: 'image/jpeg',
      size: 1000,
      capturedAt: now,
      uploadedAt: now,
      format: 'jpeg',
      sha256: 'sha',
    },
    imageHash: 'sha',
    location: {
      type: 'Point',
      coordinates: [91.7362, 26.1445],
      latitude: 26.1445,
      longitude: 91.7362,
      accuracy: 12,
      capturedAt: now,
    },
    submittedAt: now,
    aiAnalysis: null,
    aiSeverity: null,
    noDamageDetected: false,
    priority: 'LOW',
    status: 'AI_ANALYSED',
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
    suspicious: false,
    sourceIpHash: null,
    archived: false,
    createdAt: now,
    updatedAt: now,
    lastUpdatedAt: now,
    ...overrides,
  };
}

describe('civic identifiers and privacy utilities', () => {
  it('generates unguessable, non-sequential public report IDs', () => {
    const ids = Array.from({ length: 20 }, () => generatePublicReportId());
    for (const id of ids) expect(id).toMatch(/^RVR-\d{4}-[A-Z0-9]{10}$/);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('hashes public IDs deterministically without storing them as lookup values', () => {
    const id = 'RVR-2026-ABCDEFGHJK';
    const hash = hashPublicReportId(id);
    expect(hash).toBe(hashPublicReportId(id.toLowerCase()));
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(id);
  });

  it('uses constant-shaped token comparison and safe CSV escaping', () => {
    expect(safeTokenEquals('abcdef', 'abcdef')).toBe(true);
    expect(safeTokenEquals('abcdef', 'abcdeg')).toBe(false);
    expect(safeTokenEquals('short', 'much-longer')).toBe(false);
    expect(escapeCsv('=SUM(A1:A9)')).toBe('"\'=SUM(A1:A9)"');
    expect(escapeCsv('a,"b"')).toBe('"a,""b"""');
  });

  it('parses configured session durations', () => {
    expect(durationToMs('8h')).toBe(8 * 60 * 60 * 1000);
    expect(durationToMs('30m')).toBe(30 * 60 * 1000);
    expect(durationToMs('480')).toBe(480);
  });

  it('recomputes an empty AI summary and labels no-damage reports honestly', () => {
    const summary = buildDetectionSummary([]);
    expect(summary.detectionCount).toBe(0);
    expect(summary.maxSeverity).toBeNull();

    const dto = toPublicReportDto(report({ noDamageDetected: true }));
    expect(dto.message).toBe('No road damage detected.');
    expect(dto).not.toHaveProperty('exactLocation');
    expect(dto).not.toHaveProperty('priority');
    expect(dto).not.toHaveProperty('incidentPublicId');
    expect(dto).not.toHaveProperty('incidentReportCount');
    expect(JSON.stringify(dto)).not.toContain('26.1445');
    expect(JSON.stringify(dto)).not.toContain('91.7362');
  });
});

describe('captured-location validation', () => {
  it('requires finite, bounded, recent browser coordinates', () => {
    const valid = {
      latitude: 26.1445,
      longitude: 91.7362,
      accuracy: 15,
      capturedAt: new Date().toISOString(),
    };
    expect(
      createPublicReportSchema.safeParse({ location: JSON.stringify(valid) }).success,
    ).toBe(true);
    expect(
      createPublicReportSchema.safeParse({
        location: JSON.stringify({ ...valid, latitude: 120 }),
      }).success,
    ).toBe(false);
    expect(
      createPublicReportSchema.safeParse({
        location: JSON.stringify({ ...valid, longitude: Number.NaN }),
      }).success,
    ).toBe(false);
    expect(
      createPublicReportSchema.safeParse({
        location: JSON.stringify({
          ...valid,
          capturedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        }),
      }).success,
    ).toBe(false);
    expect(createPublicReportSchema.safeParse({ location: '{bad json' }).success).toBe(false);
  });
});
