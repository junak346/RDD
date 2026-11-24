import { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../../utils/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  actions?: ReactNode;
  padded?: boolean;
}

export function Card({ title, description, actions, padded = true, className, children, ...rest }: CardProps) {
  return (
    <div className={cn('surface-card', className)} {...rest}>
      {title || actions ? (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            {title ? <h3 className="text-sm font-semibold text-slate-900">{title}</h3> : null}
            {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn(padded && 'p-5')}>{children}</div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  accent?: 'brand' | 'danger' | 'warning' | 'success' | 'slate';
  loading?: boolean;
}

const ACCENT_CLASSES = {
  brand: 'bg-brand-50 text-brand-600',
  danger: 'bg-red-50 text-red-600',
  warning: 'bg-amber-50 text-amber-600',
  success: 'bg-emerald-50 text-emerald-600',
  slate: 'bg-slate-100 text-slate-600',
};

export function StatCard({ label, value, sub, icon, accent = 'brand', loading }: StatCardProps) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          {loading ? (
            <div className="skeleton mt-2 h-8 w-24" />
          ) : (
            <p className="tabular mt-1.5 text-2xl font-semibold text-slate-900">{value}</p>
          )}
          {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
        </div>
        {icon ? (
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', ACCENT_CLASSES[accent])}>
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
