import { Severity } from '../types';

interface SeverityMeta {
  label: string;
  /** Tailwind classes for badges. */
  badgeClass: string;
  /** Dot/annotation color — consistent with the AI service annotations. */
  color: string;
  rank: number;
}

export const SEVERITY_META: Record<Severity, SeverityMeta> = {
  low: {
    label: 'Low',
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    color: '#22c55e',
    rank: 0,
  },
  moderate: {
    label: 'Moderate',
    badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200',
    color: '#f59e0b',
    rank: 1,
  },
  high: {
    label: 'High',
    badgeClass: 'bg-red-50 text-red-700 ring-red-200',
    color: '#ef4444',
    rank: 2,
  },
};

export function severityMeta(severity: string | null | undefined): SeverityMeta | null {
  if (severity && severity in SEVERITY_META) {
    return SEVERITY_META[severity as Severity];
  }
  return null;
}

/** Class → color mapping consistent with ai-service/app/classes.json. */
export const CLASS_COLORS: Record<string, string> = {
  pothole: '#ef4444',
  crack: '#f59e0b',
  surface_damage: '#8b5cf6',
  other: '#64748b',
};

export function classColor(className: string): string {
  return CLASS_COLORS[className] ?? '#38bdf8';
}
