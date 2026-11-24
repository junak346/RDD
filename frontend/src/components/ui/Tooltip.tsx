import { ReactNode } from 'react';

import { cn } from '../../utils/cn';

interface TooltipProps {
  content: string;
  children: ReactNode;
  className?: string;
}

/**
 * Lightweight CSS tooltip (hover + keyboard focus). For rich content use a
 * Modal or Dropdown instead.
 */
export function Tooltip({ content, children, className }: TooltipProps) {
  return (
    <span className={cn('group relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap',
          'rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-panel',
          'transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        {content}
      </span>
    </span>
  );
}
