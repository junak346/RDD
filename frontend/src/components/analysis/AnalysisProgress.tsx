import { useEffect, useState } from 'react';

import { Spinner } from '../ui/Spinner';

const STAGES = [
  'Preparing image…',
  'Running computer vision model…',
  'Analysing road surface…',
  'Processing detections…',
  'Generating report…',
];

interface AnalysisProgressProps {
  /** 0..1 for the measured upload phase, or null when indeterminate. */
  uploadFraction: number | null;
  phase: 'uploading' | 'analysing';
}

/**
 * Progress display with honest semantics: the upload bar reflects real bytes
 * sent; analysis time is not measurable, so an indeterminate state with stage
 * labels is shown instead of a fake percentage.
 */
export function AnalysisProgress({ uploadFraction, phase }: AnalysisProgressProps) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (phase !== 'analysing') return;
    const timer = window.setInterval(() => {
      setStage((current) => Math.min(current + 1, STAGES.length - 1));
    }, 1800);
    return () => window.clearInterval(timer);
  }, [phase]);

  return (
    <div className="surface-card p-8 text-center">
      <Spinner size="lg" className="border-brand-200 border-t-brand-600" label="Analysis in progress" />
      <p className="mt-4 text-sm font-medium text-slate-800">
        {phase === 'uploading' ? 'Uploading image…' : STAGES[stage]}
      </p>

      {phase === 'uploading' ? (
        <div className="mx-auto mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-[width] duration-200"
            style={{ width: `${Math.round((uploadFraction ?? 0) * 100)}%` }}
            role="progressbar"
            aria-valuenow={Math.round((uploadFraction ?? 0) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      ) : (
        <div className="mx-auto mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-500" />
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500">
        {phase === 'uploading'
          ? 'Measured upload progress — analysis time is not predictable.'
          : 'Analysis is running — this usually takes a few seconds.'}
      </p>
    </div>
  );
}
