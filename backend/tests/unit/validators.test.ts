import { describe, expect, it } from 'vitest';

import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '../../src/validators/auth.validators';
import {
  createInspectionFieldsSchema,
  listInspectionsSchema,
  locationSchema,
} from '../../src/validators/inspection.validators';

describe('auth validators', () => {
  it('accepts a valid registration and normalises email', () => {
    const parsed = registerSchema.parse({
      name: 'Ada Lovelace',
      email: '  Ada@Example.COM ',
      password: 'analytical1engine',
    });
    expect(parsed.email).toBe('ada@example.com');
  });

  it('rejects weak passwords and bad emails', () => {
    expect(registerSchema.safeParse({ name: 'A', email: 'x', password: 'short' }).success).toBe(false);
    expect(
      registerSchema.safeParse({ name: 'Ada', email: 'ada@example.com', password: 'allletters' }).success,
    ).toBe(false);
  });

  it('requires currentPassword when setting a new one', () => {
    expect(updateProfileSchema.safeParse({ newPassword: 'newpass123' }).success).toBe(false);
    expect(
      updateProfileSchema.safeParse({ newPassword: 'newpass123', currentPassword: 'old' }).success,
    ).toBe(true);
  });

  it('validates login and forgot-password shapes', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});

describe('inspection validators', () => {
  it('bounds coordinates for location updates', () => {
    expect(locationSchema.safeParse({ latitude: 26.1, longitude: 91.7 }).success).toBe(true);
    expect(locationSchema.safeParse({ latitude: 120, longitude: 0 }).success).toBe(false);
    expect(locationSchema.safeParse({ latitude: 0, longitude: 200 }).success).toBe(false);
  });

  it('accepts partial upload fields (location optional)', () => {
    expect(createInspectionFieldsSchema.safeParse({}).success).toBe(true);
    expect(
      createInspectionFieldsSchema.safeParse({ latitude: '26.1', longitude: '91.7', address: 'GS Road' })
        .success,
    ).toBe(true);
  });

  it('applies pagination defaults and caps limit', () => {
    const parsed = listInspectionsSchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(10);
    expect(listInspectionsSchema.safeParse({ limit: 500 }).success).toBe(false);
  });

  it('coerces date filters', () => {
    const parsed = listInspectionsSchema.parse({ from: '2026-01-01', to: '2026-02-01' });
    expect(parsed.from).toBeInstanceOf(Date);
    expect(parsed.severity).toBeUndefined();
    expect(listInspectionsSchema.safeParse({ severity: 'catastrophic' }).success).toBe(false);
  });
});
