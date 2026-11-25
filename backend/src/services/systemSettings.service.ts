/** Configurable administrative settings with environment-supplied defaults. */
import { config } from '../config';
import { getCivicRepository, ICivicRepository } from '../repositories/civic';
import { PRIORITIES } from '../types/civic';

export const CIVIC_SETTINGS_KEY = 'civicOperations';

export interface CivicSystemSettings {
  /** Planning hours, not a claim about any real government SLA. */
  slaRules: Record<string, number>;
  priorityConfiguration: Record<string, string>;
  duplicateRadiusMeters: number;
  duplicateWindowHours: number;
  modelConfiguration: {
    /** Effective administrative minimum gate; never below the env baseline. */
    confidenceThreshold: number;
    baselineConfidenceThreshold: number;
    source: string;
    note: string;
  };
}

export interface CivicSettingsPatch {
  slaRules?: Record<string, number>;
  priorityConfiguration?: Record<string, string>;
  duplicateRadiusMeters?: number;
  duplicateWindowHours?: number;
  modelConfiguration?: { confidenceThreshold?: number };
}

export function defaultCivicSettings(): CivicSystemSettings {
  return {
    slaRules: { ...config.slaRules },
    priorityConfiguration: Object.fromEntries(PRIORITIES.map((priority) => [priority, priority])),
    duplicateRadiusMeters: config.publicReports.duplicateRadiusMeters,
    duplicateWindowHours: config.publicReports.duplicateWindowMs / (60 * 60 * 1000),
    modelConfiguration: {
      confidenceThreshold: config.modelConfidenceThreshold,
      baselineConfidenceThreshold: config.modelConfidenceThreshold,
      source: 'MODEL_CONFIDENCE_THRESHOLD environment variable + optional admin override',
      note: 'The backend uses the highest of the environment baseline, this administrative override and the model-reported threshold. The AI service still enforces its own MODEL_CONFIDENCE_THRESHOLD.',
    },
  };
}

function asPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** An administrator may raise, but never lower, the configured safety baseline. */
function asConfidenceThreshold(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(config.modelConfidenceThreshold, value));
}

export async function getCivicSystemSettings(
  repo: ICivicRepository = getCivicRepository(),
): Promise<CivicSystemSettings> {
  const defaults = defaultCivicSettings();
  const stored = await repo.getSetting(CIVIC_SETTINGS_KEY);
  const value = (stored?.value ?? {}) as Partial<CivicSystemSettings>;
  const slaRules = { ...defaults.slaRules };
  if (value.slaRules && typeof value.slaRules === 'object') {
    for (const priority of PRIORITIES) {
      const candidate = (value.slaRules as Record<string, unknown>)[priority];
      if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
        slaRules[priority] = candidate;
      }
    }
  }
  const storedThreshold = (value.modelConfiguration as { confidenceThreshold?: unknown } | undefined)
    ?.confidenceThreshold;
  return {
    slaRules,
    priorityConfiguration: {
      ...defaults.priorityConfiguration,
      ...(value.priorityConfiguration ?? {}),
    },
    duplicateRadiusMeters: asPositiveNumber(
      value.duplicateRadiusMeters,
      defaults.duplicateRadiusMeters,
    ),
    duplicateWindowHours: asPositiveNumber(
      value.duplicateWindowHours,
      defaults.duplicateWindowHours,
    ),
    modelConfiguration: {
      ...defaults.modelConfiguration,
      confidenceThreshold: asConfidenceThreshold(
        storedThreshold,
        defaults.modelConfiguration.confidenceThreshold,
      ),
    },
  };
}

export async function updateCivicSystemSettings(
  patch: CivicSettingsPatch,
  updatedBy?: string,
  repo: ICivicRepository = getCivicRepository(),
): Promise<CivicSystemSettings> {
  const current = await getCivicSystemSettings(repo);
  const next: CivicSystemSettings = {
    ...current,
    slaRules: { ...current.slaRules, ...(patch.slaRules ?? {}) },
    priorityConfiguration: {
      ...current.priorityConfiguration,
      ...(patch.priorityConfiguration ?? {}),
    },
    duplicateRadiusMeters: patch.duplicateRadiusMeters ?? current.duplicateRadiusMeters,
    duplicateWindowHours: patch.duplicateWindowHours ?? current.duplicateWindowHours,
    modelConfiguration: {
      ...current.modelConfiguration,
      confidenceThreshold: asConfidenceThreshold(
        patch.modelConfiguration?.confidenceThreshold,
        current.modelConfiguration.confidenceThreshold,
      ),
    },
  };
  // Persist only mutable values; baseline/source/note are derived from config.
  const persisted: Record<string, unknown> = {
    slaRules: next.slaRules,
    priorityConfiguration: next.priorityConfiguration,
    duplicateRadiusMeters: next.duplicateRadiusMeters,
    duplicateWindowHours: next.duplicateWindowHours,
    modelConfiguration: {
      confidenceThreshold: next.modelConfiguration.confidenceThreshold,
    },
  };
  await repo.setSetting(CIVIC_SETTINGS_KEY, persisted, updatedBy);
  return next;
}
