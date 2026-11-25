/**
 * Cross-cutting security audit tests for the citizen/government split.
 * Every answer to the acceptance questions below must be NO after this suite.
 */
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { config } from '../../src/config';
import { DEMO_OFFICIAL } from '../../src/repositories/civic/memory';
import { resetCivicRepository } from '../../src/repositories/civic';
import { getCivicRepository } from '../../src/repositories/civic';
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

function submit(seed: string, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post('/api/v1/public/reports')
    .field('location', location(overrides))
    .attach('image', jpeg(seed), { filename: `${seed}.jpg`, contentType: 'image/jpeg' });
}

let stub: AiStub;
let admin: ReturnType<typeof request.agent>;
let viewer: ReturnType<typeof request.agent>;
let adminCsrf = '';
let viewerCsrf = '';
let citizenToken = '';
let publicId = '';
let internalId = '';

beforeAll(async () => {
  stub = await startAiStub();
  resetCivicRepository();
  abuseGuard.reset();

  const citizen = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Security Citizen',
      email: 'security-citizen@example.com',
      password: 'password123',
    })
    .expect(201);
  citizenToken = citizen.body.data.token;

  admin = request.agent(app);
  const login = await admin
    .post('/api/v1/official/auth/login')
    .send({ email: DEMO_OFFICIAL.email, password: DEMO_OFFICIAL.password })
    .expect(200);
  adminCsrf = login.body.data.csrfToken as string;
  const cookies = (login.headers['set-cookie'] ?? []) as string[];
  expect(cookies.some((cookie) =>
    cookie.startsWith('rdd_official_session=') && cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict'),
  )).toBe(true);
  expect(cookies.some((cookie) =>
    cookie.startsWith('rdd_official_csrf=') && !cookie.includes('HttpOnly') && cookie.includes('Path=/'),
  )).toBe(true);
  expect(login.body.data).not.toHaveProperty('sessionToken');
  expect(login.body.data.official).not.toHaveProperty('passwordHash');

  const created = await submit('security-main').expect(201);
  publicId = created.body.data.report.publicReportId;

  const list = await admin.get('/api/v1/official/reports?limit=20').expect(200);
  const report = list.body.data.items.find(
    (item: { publicReportId: string }) => item.publicReportId === publicId,
  );
  expect(report).toBeTruthy();
  internalId = report.id as string;

  const provision = await admin
    .post('/api/v1/official/officials')
    .set('X-CSRF-Token', adminCsrf)
    .send({
      name: 'Security Viewer',
      email: 'security-viewer@example.com',
      department: 'Public Works',
      designation: 'Read only',
      role: 'VIEWER',
      password: 'ViewerPass!2026',
    })
    .expect(201);
  expect(provision.body.data.official).not.toHaveProperty('passwordHash');

  viewer = request.agent(app);
  const viewerLogin = await viewer
    .post('/api/v1/official/auth/login')
    .send({ email: 'security-viewer@example.com', password: 'ViewerPass!2026' })
    .expect(200);
  viewerCsrf = viewerLogin.body.data.csrfToken as string;
});

afterAll(async () => {
  await stub.close();
});

describe('public/private API separation', () => {
  it('keeps public status free of exact GPS, images, notes, priority and incident data', async () => {
    const tracked = await request(app)
      .get(`/api/v1/public/reports/${publicId}/status`)
      .expect(200);
    const report = tracked.body.data.report;
    const serialized = JSON.stringify(report);
    expect(report.publicReportId).toBe(publicId);
    expect(serialized).not.toContain('26.1445');
    expect(serialized).not.toContain('91.7362');
    for (const forbidden of [
      'exactLocation', 'image', 'internalNotes', 'auditHistory', 'sourceIpHash',
      'departmentName', 'assignedOfficialName', 'priority', 'incidentPublicId', 'incidentReportCount',
    ]) {
      expect(report).not.toHaveProperty(forbidden);
    }
  });

  it('returns NO for guessed public IDs, direct image URLs and unauthenticated official data', async () => {
    await request(app)
      .get('/api/v1/public/reports/RVR-2026-AAAAAAAAAA/status')
      .expect(404);
    await request(app)
      .get(`/api/v1/public/reports/${publicId}/image`)
      .expect(404);
    await request(app)
      .get('/uploads/road-capture.jpg')
      .expect(404);
    await request(app)
      .get('/api/v1/official/reports')
      .expect(401);
    await request(app)
      .get(`/api/v1/official/reports/${internalId}/location`)
      .expect(401);
    await request(app)
      .get(`/api/v1/official/reports/${internalId}/image`)
      .expect(401);
    await request(app)
      .get('/api/v1/official/reports')
      .set('Authorization', `Bearer ${citizenToken}`)
      .expect(401);
  });

  it('rejects invalid/malicious location payloads, missing fields and malicious uploads', async () => {
    await request(app)
      .post('/api/v1/public/reports')
      .attach('image', jpeg('missing-location'), { filename: 'road.jpg', contentType: 'image/jpeg' })
      .expect(422);
    await request(app)
      .post('/api/v1/public/reports')
      .field('location', location())
      .expect(422);
    await submit('no-sql-location', {
      latitude: { $ne: null },
      $where: 'this.archived == false',
    }).expect(422);
    await request(app)
      .post('/api/v1/public/reports')
      .field('location', '{"latitude":"<script>alert(1)</script>"}')
      .attach('image', jpeg('xss-location'), { filename: 'road.jpg', contentType: 'image/jpeg' })
      .expect(422);
    await request(app)
      .post('/api/v1/public/reports')
      .field('location', location())
      .attach('image', Buffer.from('<?php echo "evil"; ?>'), {
        filename: 'fake.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
  });

  it('rejects NoSQL-shaped official query parameters at the validation boundary', async () => {
    await admin
      .get('/api/v1/official/reports?status%5B%24ne%5D=SUBMITTED')
      .expect(422);
    await admin
      .get('/api/v1/official/reports?search%5B%24ne%5D=')
      .expect(422);
  });
});

describe('official authorization, CSRF and sessions', () => {
  it('returns NO for unauthorized status changes and CSRF-less state changes', async () => {
    await request(app)
      .patch(`/api/v1/official/reports/${internalId}/status`)
      .send({ status: 'VERIFIED' })
      .expect(401);
    await viewer
      .patch(`/api/v1/official/reports/${internalId}/status`)
      .set('X-CSRF-Token', viewerCsrf)
      .send({ status: 'VERIFIED' })
      .expect(403);
    await admin
      .post(`/api/v1/official/reports/${internalId}/actions`)
      .send({ action: 'VERIFY_REPORT' })
      .expect(403);
    await admin
      .post('/api/v1/official/auth/logout')
      .expect(403);
    await viewer
      .post('/api/v1/official/officials')
      .set('X-CSRF-Token', viewerCsrf)
      .send({
        name: 'Escalated',
        email: 'escalated-security@example.com',
        department: 'Public Works',
        designation: 'Admin',
        role: 'SUPER_ADMIN',
        password: 'Escalated!2026',
      })
      .expect(403);
  });

  it('exposes exact GPS and protected images only to an authenticated official session', async () => {
    const exact = await admin
      .get(`/api/v1/official/reports/${internalId}/location`)
      .expect(200);
    expect(exact.body.data.location.latitude).toBeCloseTo(26.1445);
    expect(exact.body.data.location.longitude).toBeCloseTo(91.7362);

    const image = await admin
      .get(`/api/v1/official/reports/${internalId}/image?variant=original`)
      .expect(200);
    expect(image.headers['content-type']).toContain('image/jpeg');
    expect(image.headers['cache-control']).toContain('no-store');
  });

  it('rejects expired official tokens and never writes passwords into audit logs', async () => {
    const official = await getCivicRepository().findOfficialByEmail(DEMO_OFFICIAL.email);
    if (!official) throw new Error('Demo official missing after repository reset');
    const expired = jwt.sign(
      {
        kind: 'official',
        sub: official.id,
        email: official.email,
        role: official.role,
        sv: official.sessionVersion,
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      config.officialAuth.secret,
      {
        issuer: 'rdd-official-backend',
        audience: 'rdd-official-portal',
      },
    );
    await request(app)
      .get('/api/v1/official/reports')
      .set('Cookie', `rdd_official_session=${expired}`)
      .expect(401);

    const logs = await admin
      .get('/api/v1/official/audit-logs?limit=100')
      .expect(200);
    expect(JSON.stringify(logs.body.data.logs)).not.toContain('ViewerPass!2026');
    expect(JSON.stringify(logs.body.data.logs)).not.toContain(DEMO_OFFICIAL.password);

    const officials = await admin.get('/api/v1/official/officials').expect(200);
    expect(JSON.stringify(officials.body.data.officials)).not.toContain('passwordHash');
  });
});
