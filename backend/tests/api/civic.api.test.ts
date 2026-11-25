/**
 * Civic-platform security and workflow tests:
 * anonymous camera report → validated GPS → AI stub → public capability ID →
 * duplicate incident grouping → protected official command-center actions.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { DEMO_OFFICIAL } from '../../src/repositories/civic/memory';
import { resetCivicRepository } from '../../src/repositories/civic';
import { abuseGuard } from '../../src/services/abuseGuard';
import { AiStub, startAiStub } from '../helpers/aiStub';

const app = createApp();

function jpeg(seed: string): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
    Buffer.from(seed),
    Buffer.alloc(64, 0x42),
  ]);
}

function location(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    latitude: 26.1445,
    longitude: 91.7362,
    accuracy: 12,
    capturedAt: new Date().toISOString(),
    ...overrides,
  });
}

let stub: AiStub;
let admin: ReturnType<typeof request.agent>;
let adminCsrf = '';
let citizenToken = '';
let firstPublicId = '';
let firstReportId = '';
let departmentId = '';

async function officialReportId(publicReportId: string): Promise<string> {
  const list = await admin
    .get(`/api/v1/official/reports?search=${encodeURIComponent(publicReportId)}&limit=20`)
    .expect(200);
  const report = list.body.data.items.find(
    (item: { publicReportId: string }) => item.publicReportId === publicReportId,
  );
  expect(report).toBeTruthy();
  return report.id as string;
}

function submitReport(seed: string, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post('/api/v1/public/reports')
    .field('location', location(overrides))
    .attach('image', jpeg(seed), { filename: `${seed}.jpg`, contentType: 'image/jpeg' });
}

beforeAll(async () => {
  stub = await startAiStub();
  resetCivicRepository();
  abuseGuard.reset();

  const citizen = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Citizen User', email: 'citizen-civic@example.com', password: 'password123' })
    .expect(201);
  citizenToken = citizen.body.data.token;

  admin = request.agent(app);
  const login = await admin
    .post('/api/v1/official/auth/login')
    .send({ email: DEMO_OFFICIAL.email, password: DEMO_OFFICIAL.password })
    .expect(200);
  adminCsrf = login.body.data.csrfToken as string;
  expect(login.headers['set-cookie'].join(' ')).toContain('HttpOnly');
  expect(login.body.data.official.role).toBe('SUPER_ADMIN');

  const departments = await admin.get('/api/v1/official/departments').expect(200);
  departmentId = departments.body.data.departments[0].id;
});

afterAll(async () => {
  await stub.close();
});

describe('anonymous citizen reporting', () => {
  it('validates location, timestamp, image content and required multipart fields', async () => {
    await request(app)
      .post('/api/v1/public/reports')
      .attach('image', jpeg('missing-location'), { filename: 'road.jpg', contentType: 'image/jpeg' })
      .expect(422);

    await request(app).post('/api/v1/public/reports').field('location', location()).expect(422);

    await submitReport('bad-lat', { latitude: 999 }).expect(422);
    await submitReport('bad-lng', { longitude: 'not-a-number' }).expect(422);
    await submitReport('old-location', {
      capturedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    }).expect(422);
    await submitReport('bad-accuracy', { accuracy: 999999 }).expect(422);

    await request(app)
      .post('/api/v1/public/reports')
      .field('location', '{"not":"json"')
      .attach('image', jpeg('bad-json'), { filename: 'road.jpg', contentType: 'image/jpeg' })
      .expect(422);

    await request(app)
      .post('/api/v1/public/reports')
      .field('location', location())
      .attach('image', Buffer.from('<?php evil ?>'), {
        filename: 'fake.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
  });

  it('creates a geolocated report through the existing AI pipeline with a strict public DTO', async () => {
    const response = await submitReport('first-report').expect(201);
    const report = response.body.data.report;
    firstPublicId = report.publicReportId;

    expect(firstPublicId).toMatch(/^RVR-\d{4}-[A-Z0-9]{10}$/);
    expect(report.status).toBe('AI_ANALYSED');
    expect(report.aiDemo).toBe(true);
    expect(report.detectedDamageType).toBeTruthy();
    expect(report.timeline.length).toBe(6);
    expect(report.generalLocation.precision).toBe('coarse');

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('26.1445');
    expect(serialized).not.toContain('91.7362');
    for (const forbidden of [
      'exactLocation',
      'image',
      'internalNotes',
      'auditHistory',
      'sourceIpHash',
      'departmentName',
      'assignedOfficialName',
      'priority',
      'incidentPublicId',
      'incidentReportCount',
    ]) {
      expect(report).not.toHaveProperty(forbidden);
    }

    firstReportId = await officialReportId(firstPublicId);
  });

  it('groups nearby same-damage reports into an incident without deleting either report', async () => {
    const second = await submitReport('second-report').expect(201);
    const secondReport = second.body.data.report;
    expect(secondReport).not.toHaveProperty('incidentPublicId');
    expect(secondReport).not.toHaveProperty('incidentReportCount');

    const secondReportId = await officialReportId(secondReport.publicReportId);
    const officialDetail = await admin
      .get(`/api/v1/official/reports/${secondReportId}`)
      .expect(200);
    expect(officialDetail.body.data.report.incident.publicIncidentId).toMatch(/^RV-[A-Z0-9]{6}$/);
    expect(officialDetail.body.data.report.incident.citizenReportCount).toBeGreaterThanOrEqual(2);

    const firstStatus = await request(app)
      .get(`/api/v1/public/reports/${firstPublicId}/status`)
      .expect(200);
    expect(firstStatus.body.data.report).not.toHaveProperty('incidentPublicId');
    expect(firstStatus.body.data.report).not.toHaveProperty('incidentReportCount');
    expect(firstStatus.body.data.report).not.toHaveProperty('priority');

    const list = await admin.get('/api/v1/official/reports?limit=20').expect(200);
    expect(list.body.data.items.filter((item: { publicReportId: string }) =>
      [firstPublicId, secondReport.publicReportId].includes(item.publicReportId),
    )).toHaveLength(2);
  });

  it('provides login-free tracking by unguessable ID and rejects guessed IDs', async () => {
    const tracked = await request(app)
      .get(`/api/v1/public/reports/${firstPublicId}/status`)
      .expect(200);
    expect(tracked.body.data.report.publicReportId).toBe(firstPublicId);
    expect(tracked.body.data.report).not.toHaveProperty('exactLocation');

    await request(app)
      .get('/api/v1/public/reports/RVR-2026-AAAAAAAAAA/status')
      .expect(404);
    await request(app)
      .get(`/api/v1/public/reports/${firstPublicId}/image`)
      .expect(404);
  });
});

describe('government portal security', () => {
  it('denies unauthenticated, citizen-token and CSRF-less requests', async () => {
    await request(app).get('/api/v1/official/reports').expect(401);
    await request(app)
      .get('/api/v1/official/reports')
      .set('Authorization', `Bearer ${citizenToken}`)
      .expect(401);
    await request(app)
      .get(`/api/v1/official/reports/${firstReportId}/image`)
      .expect(401);
    await admin
      .post(`/api/v1/official/reports/${firstReportId}/actions`)
      .send({ action: 'VERIFY_REPORT' })
      .expect(403); // CSRF token header missing
  });

  it('enforces server-side role authorization and blocks role escalation', async () => {
    const created = await admin
      .post('/api/v1/official/officials')
      .set('X-CSRF-Token', adminCsrf)
      .send({
        name: 'Read Only Viewer',
        email: 'viewer-civic@example.com',
        department: 'Public Works',
        designation: 'Viewer',
        role: 'VIEWER',
        password: 'ViewerPass!2026',
      })
      .expect(201);
    expect(created.body.data.official).not.toHaveProperty('passwordHash');

    const viewer = request.agent(app);
    const login = await viewer
      .post('/api/v1/official/auth/login')
      .send({ email: 'viewer-civic@example.com', password: 'ViewerPass!2026' })
      .expect(200);
    const viewerCsrf = login.body.data.csrfToken as string;

    await viewer.get('/api/v1/official/reports').expect(200);
    await viewer
      .post(`/api/v1/official/reports/${firstReportId}/actions`)
      .set('X-CSRF-Token', viewerCsrf)
      .send({ action: 'VERIFY_REPORT' })
      .expect(403);
    await viewer
      .post('/api/v1/official/officials')
      .set('X-CSRF-Token', viewerCsrf)
      .send({
        name: 'Escalated',
        email: 'escalated@example.com',
        department: 'Public Works',
        designation: 'Admin',
        role: 'SUPER_ADMIN',
        password: 'Escalated!2026',
      })
      .expect(403);
  });

  it('exposes exact GPS and protected images only to authorized officials', async () => {
    const locationResponse = await admin
      .get(`/api/v1/official/reports/${firstReportId}/location`)
      .expect(200);
    expect(locationResponse.body.data.location.latitude).toBeCloseTo(26.1445);
    expect(locationResponse.body.data.location.longitude).toBeCloseTo(91.7362);

    const image = await admin
      .get(`/api/v1/official/reports/${firstReportId}/image?variant=original`)
      .expect(200);
    expect(image.headers['content-type']).toContain('image/jpeg');
    expect(image.headers['cache-control']).toContain('no-store');
  });

  it('records every official action in an immutable-style audit history', async () => {
    const action = (body: Record<string, unknown>) =>
      admin
        .post(`/api/v1/official/reports/${firstReportId}/actions`)
        .set('X-CSRF-Token', adminCsrf)
        .send(body);

    expect((await action({ action: 'VERIFY_REPORT' }).expect(200)).body.data.report.status).toBe('VERIFIED');
    const assigned = await action({ action: 'ASSIGN_DEPARTMENT', departmentId }).expect(200);
    expect(assigned.body.data.report.status).toBe('ASSIGNED');
    expect(assigned.body.data.report.officialDecision.departmentName).toBeTruthy();

    const priority = await action({ action: 'CHANGE_PRIORITY', priority: 'CRITICAL' }).expect(200);
    expect(priority.body.data.report.priority).toBe('CRITICAL');
    expect(priority.body.data.report.officialDecision.dueAt).toBeTruthy();

    expect((await action({ action: 'MARK_IN_PROGRESS' }).expect(200)).body.data.report.status).toBe('IN_PROGRESS');
    expect((await action({ action: 'MARK_RESOLVED' }).expect(200)).body.data.report.status).toBe('RESOLVED');
    expect((await action({ action: 'CLOSE_CASE' }).expect(200)).body.data.report.status).toBe('CLOSED');

    const logs = await admin
      .get(`/api/v1/official/audit-logs?reportId=${firstReportId}&limit=100`)
      .expect(200);
    const actions = logs.body.data.logs.map((entry: { action: string }) => entry.action);
    for (const expected of [
      'REPORT_SUBMITTED',
      'AI_ANALYSIS_COMPLETED',
      'VERIFY_REPORT',
      'ASSIGN_DEPARTMENT',
      'CHANGE_PRIORITY',
      'MARK_RESOLVED',
      'CLOSE_CASE',
    ]) {
      expect(actions).toContain(expected);
    }

    const detail = await admin.get(`/api/v1/official/reports/${firstReportId}`).expect(200);
    expect(detail.body.data.report.actionHistory.length).toBeGreaterThanOrEqual(7);
    expect(detail.body.data.report.ai.modelVersion).toBeTruthy();
    expect(detail.body.data.report.ai.confidenceThreshold).toBe(0.35);
  });

  it('keeps the public tracking DTO free of internal decisions and exact coordinates', async () => {
    const tracked = await request(app)
      .get(`/api/v1/public/reports/${firstPublicId}/status`)
      .expect(200);
    const report = tracked.body.data.report;
    expect(report.status).toBe('CLOSED');
    expect(JSON.stringify(report)).not.toContain('91.7362');
    expect(report).not.toHaveProperty('internalNotes');
    expect(report).not.toHaveProperty('auditHistory');
  });

  it('locks an account after repeated wrong passwords and invalidates logout sessions', async () => {
    const viewer = request.agent(app);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await viewer
        .post('/api/v1/official/auth/login')
        .send({ email: 'viewer-civic@example.com', password: 'WrongPass!2026' })
        .expect(401);
    }
    const locked = await viewer
      .post('/api/v1/official/auth/login')
      .send({ email: 'viewer-civic@example.com', password: 'ViewerPass!2026' })
      .expect(429);
    expect(locked.body.error.code).toBe('RATE_LIMITED');

    await admin
      .post('/api/v1/official/auth/logout')
      .set('X-CSRF-Token', adminCsrf)
      .expect(200);
    await admin.get('/api/v1/official/auth/me').expect(401);
  });
});
