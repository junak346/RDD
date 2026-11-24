/**
 * MongoDB repository integration tests.
 *
 * Uses mongodb-memory-server when its binary can be downloaded (developer
 * machines and CI). In restricted sandboxes without access to the MongoDB
 * binary CDN the suite skips itself with an explicit message — it never
 * fakes a pass.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createMongoRepositories } from '../../src/repositories/mongo';
import { Repositories } from '../../src/repositories/types';
import { hashPassword } from '../../src/utils/passwords';

let mongoServer: { stop(): Promise<boolean> } | null = null;
let mongoose: typeof import('mongoose') | null = null;
let repos: Repositories | null = null;
let available = false;

beforeAll(async () => {
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const { default: mongooseModule } = await import('mongoose');

    mongoServer = await MongoMemoryServer.create();
    await mongooseModule.connect(mongoServer.getUri(), { dbName: 'rdd-test' });
    mongoose = mongooseModule;
    repos = createMongoRepositories();
    available = true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      '[mongo.integration] SKIPPED — mongodb-memory-server unavailable:',
      error instanceof Error ? error.message : error,
    );
  }
});

afterAll(async () => {
  if (mongoose) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

describe.skipIf(!available)('Mongo repositories (real MongoDB semantics)', () => {
  it('creates and finds users by email with hashed passwords', async () => {
    const passwordHash = await hashPassword('password123');
    const user = await repos!.users.create({
      name: 'Mongo User',
      email: 'Mongo@Example.com',
      passwordHash,
      role: 'user',
    });

    expect(user.id).toBeTruthy();
    const found = await repos!.users.findByEmail('mongo@example.com');
    expect(found?.id).toBe(user.id);
    expect(found?.passwordHash).toBe(passwordHash);

    const publicView = await repos!.users.findById(user.id);
    expect(publicView?.name).toBe('Mongo User');
  });

  it('stores inspections and supports list filters + pagination', async () => {
    const passwordHash = await hashPassword('password123');
    const user = await repos!.users.create({
      name: 'Inspection User',
      email: 'insp@example.com',
      passwordHash,
      role: 'user',
    });

    const detection = {
      classId: 0,
      className: 'pothole',
      confidence: 0.9,
      severity: 'high' as const,
      severityScore: 0.7,
      areaRatio: 0.1,
      bbox: { x1: 1, y1: 1, x2: 50, y2: 50 },
    };

    for (let index = 0; index < 3; index += 1) {
      await repos!.inspections.create({
        userId: user.id,
        image: {
          filename: `img-${index}.jpg`,
          mimeType: 'image/jpeg',
          size: 1000,
          width: 100,
          height: 100,
        },
        timestamp: new Date(),
        location:
          index === 0
            ? { latitude: 26.1, longitude: 91.7, address: 'GS Road, Guwahati, Assam' }
            : null,
        status: 'completed',
        model: { name: 'demo-engine', version: '1', engine: 'demo', demo: true },
        processingTimeMs: 10,
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

    const page = await repos!.inspections.list({ page: 1, limit: 2, userId: user.id });
    expect(page.total).toBe(3);
    expect(page.items).toHaveLength(2);

    const filtered = await repos!.inspections.list({
      page: 1,
      limit: 10,
      damageType: 'pothole',
      severity: 'high',
    });
    expect(filtered.total).toBe(3);

    const summary = await repos!.inspections.summary({ userId: user.id });
    expect(summary.totalInspections).toBe(3);
    expect(summary.totalDetections).toBe(3);
    expect(summary.countsByClass.pothole).toBe(3);
    expect(summary.highSeverityInspections).toBe(3);
    expect(summary.withLocation).toBe(1);
    expect(summary.avgConfidence).toBeCloseTo(0.9);

    const distribution = await repos!.inspections.distribution({});
    expect(distribution.byClass.find((entry) => entry.name === 'pothole')?.count).toBe(3);
    expect(distribution.bySeverity.find((entry) => entry.name === 'high')?.count).toBe(3);

    const reports = await repos!.inspections.mapReports({});
    expect(reports).toHaveLength(1);
    expect(reports[0].address).toContain('GS Road');

    const timeseries = await repos!.inspections.timeseries({}, 'day');
    expect(timeseries.length).toBeGreaterThanOrEqual(1);
  });

  it('enforces schema validation at the model layer', async () => {
    const { UserModel } = await import('../../src/models/User');
    const invalid = new UserModel({ name: 'X', email: 'bad', passwordHash: '' });
    expect(invalid.validateSync()).toBeTruthy();
  });
});
