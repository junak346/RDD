import { describe, expect, it } from 'vitest';

import {
  classLabel,
  formatBytes,
  formatDate,
  formatPercent,
  truncateId,
} from './format';

describe('format utilities', () => {
  it('formats percentages', () => {
    expect(formatPercent(0.94)).toBe('94%');
    expect(formatPercent(0.9456, 1)).toBe('94.6%');
    expect(formatPercent(0)).toBe('0%');
  });

  it('formats byte sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('renders human class labels', () => {
    expect(classLabel('pothole')).toBe('Pothole');
    expect(classLabel('surface_damage')).toBe('Surface Damage');
  });

  it('truncates ids', () => {
    expect(truncateId('abcdef1234567890', 8)).toBe('abcdef12…');
    expect(truncateId('abc', 8)).toBe('abc');
  });

  it('formats dates consistently', () => {
    const formatted = formatDate('2026-11-24T10:00:00Z');
    expect(formatted).toMatch(/2026/);
  });
});
