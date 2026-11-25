/**
 * Controlled, server-side provisioning. There is deliberately NO public
 * self-registration route for government officials.
 */
import { config } from '../config';
import { getCivicRepository, ICivicRepository } from '../repositories/civic';
import { isStrongPassword } from '../utils/passwords';
import { logger } from '../utils/logger';

import { officialAuthService } from './officialAuth.service';

/** Neutral, configurable examples — not a claim about any real government. */
const EXAMPLE_DEPARTMENTS = [
  { name: 'Public Works', code: 'PWD', description: 'Configurable example department' },
  { name: 'Road Maintenance', code: 'ROAD', description: 'Configurable example department' },
  { name: 'Municipal Engineering', code: 'ENG', description: 'Configurable example department' },
  { name: 'Traffic Department', code: 'TRAFFIC', description: 'Configurable example department' },
];

export async function ensureExampleDepartments(repo: ICivicRepository): Promise<void> {
  for (const department of EXAMPLE_DEPARTMENTS) {
    if (!(await repo.findDepartmentByName(department.name))) {
      await repo.createDepartment({ ...department, active: true });
    }
  }
}

function validateBootstrapPassword(password: string): void {
  if (
    password.length < 12 ||
    !isStrongPassword(password) ||
    !/[^A-Za-z0-9]/.test(password) ||
    !/[A-Z]/.test(password)
  ) {
    throw new Error(
      'OFFICIAL_BOOTSTRAP_PASSWORD must be 12+ characters with uppercase, lowercase, number and symbol',
    );
  }
}

export async function ensureCivicBootstrap(): Promise<void> {
  if (!config.officialBootstrap) return;
  const bootstrap = config.officialBootstrap;
  validateBootstrapPassword(bootstrap.password);

  const repo = getCivicRepository();
  await ensureExampleDepartments(repo);
  if (!(await repo.findDepartmentByName(bootstrap.department))) {
    await repo.createDepartment({
      name: bootstrap.department,
      code: bootstrap.department.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 24),
      description: 'Provisioned from server-side configuration',
      active: true,
    });
  }
  if (await repo.findOfficialByEmail(bootstrap.email)) {
    logger.info({ officialEmail: bootstrap.email }, 'official bootstrap account already exists');
    return;
  }

  await officialAuthService.provision(
    {
      name: bootstrap.name,
      email: bootstrap.email,
      department: bootstrap.department,
      designation: bootstrap.designation,
      role: 'SUPER_ADMIN',
      password: bootstrap.password,
    },
    { name: 'SYSTEM_BOOTSTRAP', role: 'SUPER_ADMIN' },
  );
  logger.info({ officialEmail: bootstrap.email }, 'official bootstrap account provisioned');
}
