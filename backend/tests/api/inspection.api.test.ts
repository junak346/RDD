/**
 * End-to-end API workflow tests:
 *   register → upload image → AI analysis (stubbed HTTP service) → stored
 *   inspection → history/filtering → analytics → map → images → delete.
 *
 * The AI stub speaks the exact FastAPI contract, so these tests exercise the
 * real HTTP client path. Demo store (DATA_MODE=demo) per tests/setup.ts.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { AiStub, startAiStub } from '../helpers/aiStub';

const app = createApp();

// Minimal but valid JPEG (magic bytes + padding — storage sniffs the header).
const JPEG_BYTES = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
  Buffer.alloc(64, 0x42),
]);

const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 0x42),
]);

let stub: AiStub;
let token = '';
let otherToken = '';

beforeAll(async () => {
  stub = await startAiStub();

  const user = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Workflow User', email: 'workflow@example.com', password: 'password123' })
    .expect(201);
  token = user.body.data.token;

  const other = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Other User', email: 'other@example.com', password: 'password123' })
    .expect(201);
  otherToken = other.body.data.token;
});

afterAll(async () => {
  await stub.close();
});

describe('inspection workflow', () => {
  let inspectionId = '';

  it('requires authentication', async () => {
    await request(app).post('/api/v1/inspections').expect(401);
    await request(app).get('/api/v1/inspections').expect(401);
    await request(app).get('/api/v1/maps/reports').expect(401);
  });

  it('rejects non-image uploads', async () => {
    const response = await request(app)
      .post('/api/v1/inspections')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('<?php evil ?>'), 'shell.php')
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_IMAGE');
  });

  it('rejects uploads without a file', async () => {
    const response = await request(app)
      .post('/api/v1/inspections')
      .set('Authorization', `Bearer ${token}`)
      .expect(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects spoofed content (fake jpeg header check)', async () => {
    // Declared as image/png but the bytes are not an image at all.
    await request(app)
      .post('/api/v1/inspections')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('this is not an image at all, not even close'), {
        filename: 'fake.png',
        contentType: 'image/png',
      })
      .expect(400);
  });

  it('analyses an image and stores the inspection', async () => {
    const response = await request(app)
      .post('/api/v1/inspections')
      .set('Authorization', `Bearer ${token}`)
      .field('latitude', '26.1445')
      .field('longitude', '91.7362')
      .field('address', 'GS Road, Guwahati, Assam')
      .attach('image', JPEG_BYTES, { filename: 'road.jpg', contentType: 'image/jpeg' })
      .expect(201);

    const inspection = response.body.data.inspection;
    inspectionId = inspection.id;

    expect(inspection.status).toBe('completed');
    expect(inspection.aiDemo).toBe(true); // honest demo flag from the AI response
    expect(inspection.model.engine).toBe('demo');
    expect(inspection.detections).toHaveLength(2);
    expect(inspection.detections[0].confidence).toBeCloseTo(0.94);
    expect(inspection.summary.detectionCount).toBe(2);
    expect(inspection.summary.maxSeverity).toBe('high');
    expect(inspection.location).toMatchObject({ latitude: 26.1445, longitude: 91.7362 });
    expect(inspection.image.url).toContain('/image?variant=original');
    expect(inspection.annotatedImage.url).toContain('variant=annotated');
  });

  it('serves the original and annotated images to the owner', async () => {
    const original = await request(app)
      .get(`/api/v1/inspections/${inspectionId}/image?variant=original`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(original.headers['content-type']).toContain('image/jpeg');

    const annotated = await request(app)
      .get(`/api/v1/inspections/${inspectionId}/image?variant=annotated`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(annotated.headers['content-type']).toContain('image/jpeg');
  });

  it('denies image access to other users', async () => {
    await request(app)
      .get(`/api/v1/inspections/${inspectionId}/image`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });

  it('lists inspections with filters, search and pagination', async () => {
    const list = await request(app)
      .get('/api/v1/inspections')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.pagination.total).toBe(1);

    const filtered = await request(app)
      .get('/api/v1/inspections?damageType=crack&severity=low')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(filtered.body.data.items).toHaveLength(1);

    const noMatch = await request(app)
      .get('/api/v1/inspections?damageType=broken_guardrail')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(noMatch.body.data.items).toHaveLength(0);

    const search = await request(app)
      .get('/api/v1/inspections?search=GS%20Road')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(search.body.data.items).toHaveLength(1);

    const badQuery = await request(app)
      .get('/api/v1/inspections?severity=apocalyptic')
      .set('Authorization', `Bearer ${token}`)
      .expect(422);
    expect(badQuery.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('shows only own inspections to non-admin users', async () => {
    const list = await request(app)
      .get('/api/v1/inspections')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(list.body.data.items).toHaveLength(0);
  });

  it('fetches a single inspection and rejects foreign access', async () => {
    const detail = await request(app)
      .get(`/api/v1/inspections/${inspectionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.data.inspection.id).toBe(inspectionId);

    await request(app)
      .get(`/api/v1/inspections/${inspectionId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);

    await request(app)
      .get('/api/v1/inspections/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('updates the inspection location', async () => {
    const response = await request(app)
      .patch(`/api/v1/inspections/${inspectionId}/location`)
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 26.18, longitude: 91.77, address: 'Chandmari, Guwahati, Assam' })
      .expect(200);
    expect(response.body.data.inspection.location.address).toContain('Chandmari');

    await request(app)
      .patch(`/api/v1/inspections/${inspectionId}/location`)
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 999, longitude: 0 })
      .expect(422);
  });

  it('computes analytics from stored data (no hardcoded numbers)', async () => {
    // Add a second, different inspection to make distributions meaningful.
    await request(app)
      .post('/api/v1/inspections')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', PNG_BYTES, { filename: 'road2.png', contentType: 'image/png' })
      .expect(201);

    const summary = await request(app)
      .get('/api/v1/analytics/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(summary.body.data.totalInspections).toBe(2);
    expect(summary.body.data.totalDetections).toBe(4); // 2 per inspection from the stub
    expect(summary.body.data.countsByClass.pothole).toBe(2);
    expect(summary.body.data.highSeverityInspections).toBe(2);
    expect(summary.body.data.withLocation).toBe(1);

    const timeseries = await request(app)
      .get('/api/v1/analytics/timeseries?interval=day')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(timeseries.body.data.points.length).toBeGreaterThanOrEqual(1);
    const total = timeseries.body.data.points.reduce(
      (sum: number, p: { inspections: number }) => sum + p.inspections,
      0,
    );
    expect(total).toBe(2);

    const distribution = await request(app)
      .get('/api/v1/analytics/distribution')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const classSum = distribution.body.data.byClass.reduce(
      (sum: number, entry: { count: number }) => sum + entry.count,
      0,
    );
    expect(classSum).toBe(4);
  });

  it('returns map reports for located inspections only', async () => {
    const response = await request(app)
      .get('/api/v1/maps/reports')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const reports = response.body.data.reports;
    expect(reports).toHaveLength(1); // only the first inspection has a location
    expect(reports[0]).toMatchObject({
      latitude: 26.18,
      longitude: 91.77,
      detectionCount: 2,
      maxSeverity: 'high',
    });
    expect(reports[0].damageTypes).toContain('pothole');
    expect(reports[0].inspectionUrl).toContain('/api/v1/inspections/');
  });

  it('lists recent inspections', async () => {
    const response = await request(app)
      .get('/api/v1/inspections/recent?limit=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body.data.items.length).toBe(2);
  });

  it('deletes an inspection and its images', async () => {
    await request(app)
      .delete(`/api/v1/inspections/${inspectionId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);

    await request(app)
      .delete(`/api/v1/inspections/${inspectionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(app)
      .get(`/api/v1/inspections/${inspectionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    await request(app)
      .get(`/api/v1/inspections/${inspectionId}/image`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
