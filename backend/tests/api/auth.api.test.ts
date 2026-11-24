/**
 * API tests: authentication, profile management, password recovery.
 * Uses the in-memory demo store (DATA_MODE=demo) — see tests/setup.ts.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';

const app = createApp();

describe('auth API', () => {
  it('registers, signs in and returns the profile', async () => {
    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test User', email: 'user@example.com', password: 'password123' })
      .expect(201);

    expect(register.body.success).toBe(true);
    expect(register.body.meta.dataMode).toBe('demo'); // honest labelling
    expect(register.body.data.user.email).toBe('user@example.com');
    expect(register.body.data.user.passwordHash).toBeUndefined();
    expect(register.body.data.token).toBeTruthy();

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'password123' })
      .expect(200);
    const token = login.body.data.token;

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.data.user.name).toBe('Test User');
  });

  it('rejects duplicate registration and wrong credentials', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Dup User', email: 'dup@example.com', password: 'password123' })
      .expect(201);

    const duplicate = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Dup User', email: 'dup@example.com', password: 'password123' })
      .expect(409);
    expect(duplicate.body.error.code).toBe('EMAIL_TAKEN');

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'dup@example.com', password: 'wrongpass1' })
      .expect(401);
  });

  it('rejects invalid registration payloads with field details', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'weak' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.error.details)).toBe(true);
  });

  it('protects routes without a token', async () => {
    await request(app).get('/api/v1/auth/me').expect(401);
    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer garbage')
      .expect(401);
  });

  it('runs the full password-recovery flow', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Reset User', email: 'reset@example.com', password: 'password123' })
      .expect(201);

    const forgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'reset@example.com' })
      .expect(202);
    const resetToken = forgot.body.data.resetToken;
    expect(resetToken).toBeTruthy(); // EXPOSE_RESET_TOKENS=true in tests only

    // Unknown emails get the identical response (no enumeration).
    const unknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.com' })
      .expect(202);
    expect(unknown.body.data.resetToken).toBeUndefined();

    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, password: 'newpassword1' })
      .expect(200);

    // Old password no longer works; the new one does.
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'reset@example.com', password: 'password123' })
      .expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'reset@example.com', password: 'newpassword1' })
      .expect(200);

    // A consumed token cannot be reused.
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, password: 'anotherpass1' })
      .expect(401);
  });

  it('updates the profile and changes the password', async () => {
    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Profile User', email: 'profile@example.com', password: 'password123' })
      .expect(201);
    const token = register.body.data.token;

    const updated = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed User' })
      .expect(200);
    expect(updated.body.data.user.name).toBe('Renamed User');

    await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'changedpass1', currentPassword: 'wrong' })
      .expect(401);

    await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'changedpass1', currentPassword: 'password123' })
      .expect(200);

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'profile@example.com', password: 'changedpass1' })
      .expect(200);
  });

  it('requires admin for the user listing', async () => {
    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Normal User', email: 'normal@example.com', password: 'password123' })
      .expect(201);

    await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${register.body.data.token}`)
      .expect(403);
  });
});

describe('health API', () => {
  it('answers liveness and readiness', async () => {
    const live = await request(app).get('/health').expect(200);
    expect(live.body.data.status).toBe('ok');

    const ready = await request(app).get('/api/v1/health').expect(200);
    expect(ready.body.data.dataMode).toBe('demo');
    expect(ready.body.data.database.mode).toBe('demo');
    // AI service is stubbed/offline in unit tests — must report honestly.
    expect(ready.body.data.ai.reachable).toBe(false);
  });
});
