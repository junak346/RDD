/**
 * User profile management and admin user listing.
 */
import { getRepositories } from '../repositories';
import { UserRole } from '../types/domain';
import { errors } from '../utils/errors';
import { hashPassword, verifyPassword } from '../utils/passwords';

import { PublicUser } from './auth.service';

function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

export const userService = {
  async updateProfile(
    userId: string,
    input: {
      name?: string;
      currentPassword?: string;
      newPassword?: string;
    },
  ): Promise<PublicUser> {
    const repos = getRepositories();
    const user = await repos.users.findById(userId);
    if (!user) throw errors.notFound('User not found.');

    const patch: { name?: string; passwordHash?: string } = {};
    if (input.name) patch.name = input.name;

    if (input.newPassword) {
      const record = await repos.users.findByEmail(user.email);
      if (!record) throw errors.notFound('User not found.');
      const valid = await verifyPassword(input.currentPassword ?? '', record.passwordHash);
      if (!valid) throw errors.invalidCredentials('Current password is incorrect.');
      patch.passwordHash = await hashPassword(input.newPassword);
    }

    const updated = await repos.users.update(userId, patch);
    if (!updated) throw errors.notFound('User not found.');
    return toPublicUser(updated);
  },

  async listUsers(page: number, limit: number) {
    const repos = getRepositories();
    const result = await repos.users.list(page, limit);
    return {
      items: result.items.map(toPublicUser),
      pagination: { page: result.page, limit: result.limit, total: result.total },
    };
  },
};
