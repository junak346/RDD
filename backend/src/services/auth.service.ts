/**
 * Authentication and account-recovery flows.
 */
import crypto from 'crypto';

import { config } from '../config';
import { getRepositories } from '../repositories';
import { UserRecord } from '../types/domain';
import { errors } from '../utils/errors';
import { hashPassword, verifyPassword } from '../utils/passwords';
import { signToken } from '../utils/tokens';
import { buildResetUrl, emailService } from './email.service';

const RESET_TOKEN_TTL_MINUTES = 30;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

function issueToken(user: UserRecord): string {
  return signToken({ sub: user.id, email: user.email, role: user.role });
}

export const authService = {
  async register(input: { name: string; email: string; password: string }): Promise<AuthResult> {
    const repos = getRepositories();
    const existing = await repos.users.findByEmail(input.email);
    if (existing) throw errors.emailTaken();

    // Bootstrap admin accounts from the configured allow-list only.
    const role = config.adminEmails.includes(input.email.toLowerCase()) ? 'admin' : 'user';
    const passwordHash = await hashPassword(input.password);
    const user = await repos.users.create({
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      role,
    });
    return { user: toPublicUser(user), token: issueToken(user) };
  },

  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const repos = getRepositories();
    const user = await repos.users.findByEmail(input.email);
    if (!user) throw errors.invalidCredentials();
    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) throw errors.invalidCredentials();
    return { user: toPublicUser(user), token: issueToken(user) };
  },

  async requestPasswordReset(email: string): Promise<{ resetToken?: string }> {
    const repos = getRepositories();
    const user = await repos.users.findByEmail(email);
    // Always respond identically to avoid leaking which emails are registered.
    if (!user) return {};

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await repos.passwordResets.invalidateForUser(user.id);
    await repos.passwordResets.create({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
    });

    emailService.sendPasswordReset({ to: user.email, resetUrl: buildResetUrl(token) });

    // Dev/test convenience only (config forces this off in production).
    return config.exposeResetTokens ? { resetToken: token } : {};
  },

  async resetPassword(input: { token: string; password: string }): Promise<void> {
    const repos = getRepositories();
    const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');
    const record = await repos.passwordResets.findValidByHash(tokenHash, new Date());
    if (!record) throw errors.invalidToken('This reset link is invalid or has expired.');

    const passwordHash = await hashPassword(input.password);
    await repos.users.update(record.userId, { passwordHash });
    await repos.passwordResets.markUsed(record.id, new Date());
    await repos.passwordResets.invalidateForUser(record.userId);
  },

  async getProfile(userId: string): Promise<PublicUser> {
    const repos = getRepositories();
    const user = await repos.users.findById(userId);
    if (!user) throw errors.notFound('User not found.');
    return toPublicUser(user);
  },
};
