/**
 * Toast notification system (small, dependency-free, accessible).
 */
import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, Info, X, XCircle, AlertTriangle } from 'lucide-react';

import { cn } from '../utils/cn';

type Tone = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  tone: Tone;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (tone: Tone, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

const TONE_ICONS: Record<Tone, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const TONE_CLASSES: Record<Tone, string> = {
  success: 'border-emerald-200 bg-white text-slate-800',
  error: 'border-red-200 bg-white text-slate-800',
  info: 'border-sky-200 bg-white text-slate-800',
  warning: 'border-amber-200 bg-white text-slate-800',
};

const TONE_ICON_CLASSES: Record<Tone, string> = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-sky-500',
  warning: 'text-amber-500',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (tone: Tone, title: string, message?: string) => {
      const id = nextId++;
      setToasts((current) => [...current.slice(-3), { id, tone, title, message }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, message) => toast('success', title, message),
      error: (title, message) => toast('error', title, message),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((item) => {
          const Icon = TONE_ICONS[item.tone];
          return (
            <div
              key={item.id}
              role={item.tone === 'error' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-panel animate-fade-up',
                TONE_CLASSES[item.tone],
              )}
            >
              <Icon size={18} className={cn('mt-0.5 shrink-0', TONE_ICON_CLASSES[item.tone])} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                {item.message ? <p className="mt-0.5 text-xs text-slate-500">{item.message}</p> : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(item.id)}
                className="rounded p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
