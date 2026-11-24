/**
 * Mongoose schema validation (runs without a database connection) and
 * in-memory repository semantics (the DATA_MODE=demo data layer).
 */
import { describe, expect, it } from 'vitest';

import { InspectionModel } from '../../src/models/Inspection';
import { UserModel } from '../../src/models/User';
import { createMemoryRepositories } from '../../src/repositories/memory';

describe('mongoose schemas', () => {
  it('validates the user schema without a connection', () => {
    const invalid = new UserModel({ name: 'X', email: 'not-an-email', passwordHash: '' });
    expect(invalid.validateSync()).toBeTruthy();

    const valid = new UserModel({
      name: 'Valid User',
      email: 'valid@example.com',
      passwordHash: 'hash',
    });
    expect(valid.validateSync()).toBeUndefined();
    expect(valid.role).toBe('user');
  });

  it('validates detection enums and bbox requirements', () => {
    const invalid = new InspectionModel({
      userId: '507f1f77bcf86cd799439011',
      image: { filename: 'a.jpg', mimeType: 'image/jpeg', size: 10 },
      model: { name: 'demo', version: '1', engine: 'demo', demo: true },
      processingTimeMs: 5,
      detections: [
        {
          classId: 0,
          className: 'pothole',
          confidence: 2.0, // out of range
          severity: 'catastrophic', // not a valid severity
          severityScore: 0.5,
          areaRatio: 0.1,
          bbox: { x1: 0, y1: 0, x2: 1, y2: 1 },
        },
      ],
      summary: { detectionCount: 1 },
    });
    const error = invalid.validateSync();
    expect(error).toBeTruthy();
  });
});

describe('memory repositories (demo data layer)', () => {
  const detection = {
    classId: 0,
    className: 'pothole',
    confidence: 0.8,
    severity: 'high' as const,
    severityScore: 0.7,
    areaRatio: 0.1,
    bbox: { x1: 0, y1: 0, x2: 10, y2: 10 },
  };

  async function seed() {
    const repos = createMemoryRepositories();
    const user = await repos.users.create({
      name: 'Demo',
      email: 'demo@test.local',
      passwordHash: 'hash',
      role: 'user',
    });
    for (let index = 0; index < 5; index += 1) {
      await repos.inspections.create({
        userId: user.id,
        image: { filename: `f${index}.jpg`, mimeType: 'image/jpeg', size: 10 },
        timestamp: new Date(Date.now() - index * 86_400_000),
        location:
          index % 2 === 0
            ? { latitude: 26.1, longitude: 91.7, address: `Area ${index}, Guwahati` }
            : null,
        status: 'completed',
        model: { name: 'demo-engine', version: '1', engine: 'demo', demo: true },
        processingTimeMs: 5,
        aiWarnings: [],
        detections: [detection],
        summary: {
          detectionCount: 1,
          countsByClass: { pothole: 1 },
          countsBySeverity: { low: 0, moderate: 0, high: 1 },
          maxSeverity: 'high',
        },
      });
    }
    return { repos, user };
  }

  it('paginates and sorts consistently', async () => {
    const { repos, user } = await seed();
    const page1 = await repos.inspections.list({ page: 1, limit: 2, userId: user.id });
    expect(page1.total).toBe(5);
    expect(page1.items).toHaveLength(2);

    const asc = await repos.inspections.list({
      page: 1,
      limit: 5,
      sort: 'createdAt_asc',
      userId: user.id,
    });
    expect(asc.items[0].createdAt.getTime()).toBeLessThanOrEqual(
      asc.items[4].createdAt.getTime(),
    );
  });

  it('computes summary statistics from stored records', async () => {
    const { repos } = await seed();
    const summary = await repos.inspections.summary({});
    expect(summary.totalInspections).toBe(5);
    expect(summary.totalDetections).toBe(5);
    expect(summary.withLocation).toBe(3);
    expect(summary.countsBySeverity.high).toBe(5);
  });

  it('finds password resets only while valid', async () => {
    const { repos, user } = await seed();
    const record = await repos.passwordResets.create({
      userId: user.id,
      tokenHash: 'hash-1',
      expiresAt: new Date(Date.now() + 1000),
    });
    expect(await repos.passwordResets.findValidByHash('hash-1', new Date())).toBeTruthy();
    await repos.passwordResets.markUsed(record.id, new Date());
    expect(await repos.passwordResets.findValidByHash('hash-1', new Date())).toBeNull();
    expect(
      await repos.passwordResets.findValidByHash('hash-1', new Date(Date.now() + 5000)),
    ).toBeNull();
  });
});
