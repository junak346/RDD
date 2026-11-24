import { Detection } from '../../types';
import { classLabel, formatPercent } from '../../utils/format';
import { classColor, severityMeta } from '../../utils/severity';
import { SeverityBadge } from '../ui/Badge';

interface DetectionListProps {
  detections: Detection[];
  hoveredIndex?: number | null;
  onHover?: (index: number | null) => void;
  compact?: boolean;
}

export function DetectionList({ detections, hoveredIndex, onHover, compact }: DetectionListProps) {
  if (detections.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
        No road damage detected in this image.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100" role="list">
      {detections.map((detection, index) => (
        <li
          key={`${detection.className}-${index}`}
          onMouseEnter={() => onHover?.(index)}
          onMouseLeave={() => onHover?.(null)}
          onFocus={() => onHover?.(index)}
          onBlur={() => onHover?.(null)}
          tabIndex={onHover ? 0 : undefined}
          className={`px-4 py-3 transition-colors ${hoveredIndex === index ? 'bg-brand-50/60' : ''}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: classColor(detection.className) }}
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {classLabel(detection.className)}
                </p>
                {!compact ? (
                  <p className="tabular mt-0.5 text-xs text-slate-500">
                    Box ({Math.round(detection.bbox.x1)}, {Math.round(detection.bbox.y1)}) → (
                    {Math.round(detection.bbox.x2)}, {Math.round(detection.bbox.y2)}) · area{' '}
                    {formatPercent(detection.areaRatio, 1)}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Confidence</span>
                  <span className="tabular font-medium text-slate-800">
                    {formatPercent(detection.confidence)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(detection.confidence * 100)}%`,
                      backgroundColor: classColor(detection.className),
                    }}
                  />
                </div>
              </div>
              <SeverityBadge severity={detection.severity} />
            </div>
          </div>
          {!compact ? (
            <p className="mt-1 pl-5 text-[11px] text-slate-400">
              Severity {severityMeta(detection.severity)?.label.toLowerCase()} (estimated · score{' '}
              {detection.severityScore.toFixed(2)}) — heuristic estimate, not an engineering
              assessment.
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
