import { ReactNode } from 'react';

import { cn } from '../../utils/cn';
import { severityMeta } from '../../utils/severity';
import { Severity } from '../../types';

interface BadgeProps {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const TONE_CLASSES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
};

export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SeverityBadge({ severity, className }: { severity: Severity | null; className?: string }) {
  const meta = severityMeta(severity);
  if (!meta) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        meta.badgeClass,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}

/** Honest demo-mode chip — used wherever demo data or demo AI results appear. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="warning" className={cn('font-semibold uppercase tracking-wide', className)}>
      Demo
    </Badge>
  );
}
