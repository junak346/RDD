import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this content. Please try again.',
  onRetry,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center rounded-lg border border-red-100 bg-red-50/50 text-center ${
        compact ? 'px-6 py-8' : 'px-6 py-14'
      }`}
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
        <AlertTriangle size={20} />
      </div>
      <h3 className="text-sm font-semibold text-red-900">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-red-700/80">{message}</p>
      {onRetry ? (
        <Button size="sm" variant="outline" className="mt-4" icon={<RefreshCw size={14} />} onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
