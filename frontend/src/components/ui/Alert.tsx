import { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';

import { cn } from '../../utils/cn';

type Tone = 'info' | 'success' | 'warning' | 'danger';

interface AlertProps {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  onDismiss?: () => void;
  className?: string;
  icon?: ReactNode;
}

const TONE_STYLES: Record<Tone, { wrap: string; icon: typeof Info }> = {
  info: { wrap: 'border-sky-200 bg-sky-50 text-sky-900', icon: Info },
  success: { wrap: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CheckCircle2 },
  warning: { wrap: 'border-amber-200 bg-amber-50 text-amber-900', icon: AlertTriangle },
  danger: { wrap: 'border-red-200 bg-red-50 text-red-900', icon: XCircle },
};

export function Alert({ tone = 'info', title, children, onDismiss, className, icon }: AlertProps) {
  const styles = TONE_STYLES[tone];
  const Icon = styles.icon;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', styles.wrap, className)}
    >
      <span className="mt-0.5 shrink-0">{icon ?? <Icon size={18} aria-hidden />}</span>
      <div className="flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-1', 'text-sm opacity-90')}>{children}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded p-1 opacity-60 transition-opacity hover:opacity-100"
        >
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}
