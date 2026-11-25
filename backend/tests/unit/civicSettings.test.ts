import { beforeEach, describe, expect, it } from 'vitest';

import { config } from '../../src/config';
import { resetCivicRepository } from '../../src/repositories/civic';
import {
  getCivicSystemSettings,
  updateCivicSystemSettings,
} from '../../src/services/systemSettings.service';
import { settingsPatchSchema } from '../../src/validators/civic.validators';

describe('administrative civic settings', () => {
  beforeEach(() => {
    resetCivicRepository();
  });

  it('starts from MODEL_CONFIDENCE_THRESHOLD and lets admins raise but not lower the gate', async () => {
    const defaults = await getCivicSystemSettings();
    expect(defaults.modelConfiguration.confidenceThreshold).toBe(config.modelConfidenceThreshold);
    expect(defaults.modelConfiguration.baselineConfidenceThreshold).toBe(config.modelConfidenceThreshold);

    const raised = await updateCivicSystemSettings({
      modelConfiguration: { confidenceThreshold: 0.9 },
      slaRules: { LOW: 120 },
    });
    expect(raised.modelConfiguration.confidenceThreshold).toBe(0.9);
    expect(raised.slaRules.LOW).toBe(120);

    const persisted = await getCivicSystemSettings();
    expect(persisted.modelConfiguration.confidenceThreshold).toBe(0.9);
    expect(persisted.slaRules.LOW).toBe(120);

    const attemptedLower = await updateCivicSystemSettings({
      modelConfiguration: { confidenceThreshold: 0.01 },
    });
    expect(attemptedLower.modelConfiguration.confidenceThreshold).toBe(config.modelConfidenceThreshold);
  });

  it('validates model threshold patches at the API boundary', () => {
    expect(settingsPatchSchema.safeParse({
      modelConfiguration: { confidenceThreshold: 0.8 },
    }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({
      modelConfiguration: { confidenceThreshold: 2 },
    }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({
      modelConfiguration: { confidenceThreshold: 0.5, unknown: true },
    }).success).toBe(false);
  });
});
