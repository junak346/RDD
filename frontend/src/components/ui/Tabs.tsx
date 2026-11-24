import { ReactNode, useState } from 'react';

import { cn } from '../../utils/cn';

interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  defaultTab?: string;
  className?: string;
  /** Controlled mode */
  active?: string;
  onChange?: (id: string) => void;
}

export function Tabs({ items, defaultTab, className, active, onChange }: TabsProps) {
  const [internal, setInternal] = useState(defaultTab ?? items[0]?.id);
  const current = active ?? internal;

  const select = (id: string) => {
    if (active === undefined) setInternal(id);
    onChange?.(id);
  };

  return (
    <div className={className}>
      <div role="tablist" className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {items.map((item) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={current === item.id}
            onClick={() => select(item.id)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              current === item.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-4">
        {items.find((item) => item.id === current)?.content}
      </div>
    </div>
  );
}
