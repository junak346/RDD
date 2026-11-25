/**
 * Separate government authentication service. Accounts are provisioned only by
 * authorized administrators or a server-side bootstrap; there is no public
 * official registration endpoint.
 */
import crypto from 'crypto';

import bcrypt from 'bcryptjs';

import { config } from '../config';
import { getCivicRepository } from '../repositories/civic';
import {
  OfficialRecord,
  OfficialRole,
} from '../types/civic';
import { createOfficialSchema } from '../validators/civic.validators';
import { auditEvent, generateCsrfToken } from '../utils/civic';
import { errors } from '../utils/errors';
import { hashPassword, verifyPassword } from '../utils/passwords';
import { signOfficialToken } from '../utils/tokens';

import { publishDomainEvent } from './domainEvents';

// Used only to keep missing-account timing comparable; not a real credential.
const DUMMY_HASH = bcrypt.hashSync('no-such-official-account', 4);

export interface PublicOfficial {
  id: string;
  officialId: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  role: OfficialRole;
  accountStatus: 'ACTIVE' | 'SUSPENDED';
  lastLoginAt: string | null;
  createdAt: string;
}

export interface OfficialLoginResult {
  official: PublicOfficial;
  sessionToken: string;
  csrfToken: string;
}

export interface ProvisionOfficialInput {
  name: string;
  email: string;
  department: string;
  designation: string;
  role: OfficialRole;
  password: string;
}

export interface ProvisionActor {
  id?: string;
  name: string;
  role: OfficialRole;
}

export function toPublicOfficial(official: OfficialRecord): PublicOfficial {
  return {
    id: official.id,
    officialId: official.officialId,
    name: official.name,
    email: official.email,
    department: official.department,
    designation: official.designation,
    role: official.role,
    accountStatus: official.accountStatus,
    lastLoginAt: official.lastLoginAt?.toISOString() ?? null,
    createdAt: official.createdAt.toISOString(),
  };
}

async function appendSystemAudit(
  action: string,
  actor: string,
  role: string,
  metadata?: Record<string, unknown>,
  actorId?: string,
): Promise<void> {
  const event = auditEvent({ actor, actorId, role, action, metadata });
  await getCivicRepository().appendAudit({ ...event });
}

export const officialAuthService = {
  async login(email: string, password: string): Promise<OfficialLoginResult> {
    const repo = getCivicRepository();
    const official = await repo.findOfficialByEmail(email);
    if (!official) {
      await verifyPassword(password, DUMMY_HASH);
      throw errors.invalidCredentials();
    }
    if (official.accountStatus !== 'ACTIVE') throw errors.invalidCredentials();

    const now = new Date();
    if (official.lockedUntil && official.lockedUntil > now) {
      throw errors.rateLimited('This official account is temporarily locked. Please try again later.');
    }

    const valid = await verifyPassword(password, official.passwordHash);
    if (!valid) {
      const failedLoginAttempts = official.failedLoginAttempts + 1;
      const shouldLock = failedLoginAttempts >= config.officialAuth.maxFailedLogins;
      await repo.updateOfficial(official.id, {
        failedLoginAttempts: shouldLock ? 0 : failedLoginAttempts,
        lockedUntil: shouldLock ? new Date(now.getTime() + config.officialAuth.lockoutMs) : null,
      });
      await appendSystemAudit('OFFICIAL_LOGIN_FAILED', official.email, 'UNAUTHENTICATED', {
        failedLoginAttempts,
        locked: shouldLock,
      });
      publishDomainEvent('OFFICIAL_LOGIN_FAILED', { officialId: official.officialId, locked: shouldLock });
      throw errors.invalidCredentials();
    }

    const updated =
      (await repo.updateOfficial(official.id, {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: now,
      })) ?? official;

    await appendSystemAudit(
      'OFFICIAL_LOGIN',
      updated.name,
      updated.role,
      { officialId: updated.officialId },
      updated.id,
    );
    publishDomainEvent('OFFICIAL_LOGIN', { officialId: updated.officialId, role: updated.role });

    return {
      official: toPublicOfficial(updated),
      sessionToken: signOfficialToken({
        kind: 'official',
        sub: updated.id,
        email: updated.email,
        role: updated.role,
        sv: updated.sessionVersion,
      }),
      csrfToken: generateCsrfToken(),
    };
  },

  async logout(officialId: string, name: string, role: OfficialRole): Promise<void> {
    const repo = getCivicRepository();
    const official = await repo.findOfficialById(officialId);
    if (official) {
      // Bumping the session version invalidates all previously issued tokens.
      await repo.updateOfficial(official.id, { sessionVersion: official.sessionVersion + 1 });
    }
    await appendSystemAudit('OFFICIAL_LOGOUT', name, role, { officialId }, officialId);
    publishDomainEvent('OFFICIAL_LOGOUT', { officialId });
  },

  async me(officialId: string): Promise<PublicOfficial> {
    const official = await getCivicRepository().findOfficialById(officialId);
    if (!official || official.accountStatus !== 'ACTIVE') {
      throw errors.invalidToken('The official account is no longer active.');
    }
    return toPublicOfficial(official);
  },

  async provision(input: ProvisionOfficialInput, actor: ProvisionActor): Promise<PublicOfficial> {
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
      throw errors.forbidden('Only administrators may provision official accounts.');
    }
    if (input.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw errors.forbidden('Only a super administrator may create another super administrator.');
    }

    const parsed = createOfficialSchema.safeParse(input);
    if (!parsed.success) {
      throw errors.validation('Invalid official account details.', parsed.error.issues);
    }
    const repo = getCivicRepository();
    if (await repo.findOfficialByEmail(parsed.data.email)) {
      throw errors.conflict('An official account with that email already exists.');
    }
    if (!(await repo.findDepartmentByName(parsed.data.department))) {
      throw errors.validation('Create the department before provisioning an official for it.');
    }

    const official = await repo.createOfficial({
      officialId: `GOV-${new Date().getUTCFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      name: parsed.data.name,
      email: parsed.data.email,
      department: parsed.data.department,
      designation: parsed.data.designation,
      role: parsed.data.role,
      passwordHash: await hashPassword(parsed.data.password),
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
      sessionVersion: 1,
      lastLoginAt: null,
    });
    await appendSystemAudit(
      'OFFICIAL_ACCOUNT_CREATED',
      actor.name,
      actor.role,
      { officialId: official.officialId, targetRole: official.role },
      actor.id,
    );
    return toPublicOfficial(official);
  },
};
