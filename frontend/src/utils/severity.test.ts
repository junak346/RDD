import { describe, expect, it } from 'vitest';

import { classColor, severityMeta } from './severity';

describe('severity metadata', () => {
  it('maps severities to display metadata', () => {
    expect(severityMeta('high')?.label).toBe('High');
    expect(severityMeta('moderate')?.label).toBe('Moderate');
    expect(severityMeta('low')?.label).toBe('Low');
    expect(severityMeta(null)).toBeNull();
    expect(severityMeta('catastrophic')).toBeNull();
  });

  it('keeps class colors consistent with the AI annotation palette', () => {
    expect(classColor('pothole')).toBe('#ef4444');
    expect(classColor('crack')).toBe('#f59e0b');
    expect(classColor('surface_damage')).toBe('#8b5cf6');
    expect(classColor('unknown-class')).toBe('#38bdf8');
  });
});
