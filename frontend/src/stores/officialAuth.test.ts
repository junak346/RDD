import { describe, expect, it } from 'vitest';

import { GovernmentOfficial } from '../types';

import { roleAllows } from './officialAuth';

function official(role: GovernmentOfficial['role']): GovernmentOfficial {
  return {
    id: 'official_test',
    officialId: 'GOV-0001',
    name: 'Test Official',
    email: 'official@agency.example',
    department: 'Operations',
    designation: 'Inspector',
    role,
    accountStatus: 'ACTIVE',
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
  };
}

describe('roleAllows', () => {
  it('allows only explicitly permitted government roles', () => {
    expect(roleAllows(official('SUPER_ADMIN'), ['SUPER_ADMIN', 'ADMIN'])).toBe(true);
    expect(roleAllows(official('DEPARTMENT_OFFICIAL'), ['SUPER_ADMIN', 'ADMIN'])).toBe(false);
    expect(roleAllows(official('VIEWER'), ['VIEWER'])).toBe(true);
    expect(roleAllows(null, ['SUPER_ADMIN'])).toBe(false);
  });
});
