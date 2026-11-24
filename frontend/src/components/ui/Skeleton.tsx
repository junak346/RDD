import { CSSProperties } from 'react';

import { cn } from '../../utils/cn';

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={cn('skeleton', className)} style={style} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="surface-card space-y-3 p-5" aria-hidden>
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="surface-card overflow-hidden" aria-hidden>
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <Skeleton className="h-4 w-40" />
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 border-b border-slate-50 px-4 py-3 last:border-0">
          {Array.from({ length: cols }).map((__, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={cn('surface-card flex items-end gap-2 p-5', height)} aria-hidden>
      {[40, 65, 50, 80, 60, 90, 70, 55].map((value, index) => (
        <Skeleton key={index} className="flex-1" style={{ height: `${value}%` }} />
      ))}
    </div>
  );
}
