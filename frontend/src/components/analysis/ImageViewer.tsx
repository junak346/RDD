import { useCallback, useRef, useState } from 'react';
import { Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';

import { useAuthImage } from '../../hooks/useAuthImage';
import { Detection } from '../../types';
import { cn } from '../../utils/cn';
import { classLabel } from '../../utils/format';
import { classColor } from '../../utils/severity';
import { Spinner } from '../ui/Spinner';

interface ImageViewerProps {
  originalUrl: string | null;
  annotatedUrl: string | null;
  detections: Detection[];
  imageWidth?: number;
  imageHeight?: number;
  hoveredIndex?: number | null;
  className?: string;
}

/**
 * Interactive computer-vision result viewer:
 *  - original / annotated toggle
 *  - zoom (wheel + buttons), pan (drag), reset
 *  - hover-highlight overlay boxes linked to the detection list
 */
export function ImageViewer({
  originalUrl,
  annotatedUrl,
  detections,
  imageWidth = 1,
  imageHeight = 1,
  hoveredIndex = null,
  className,
}: ImageViewerProps) {
  const [variant, setVariant] = useState<'annotated' | 'original'>(
    annotatedUrl ? 'annotated' : 'original',
  );
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );

  const activeUrl = variant === 'annotated' ? annotatedUrl : originalUrl;
  const { src, loading, error } = useAuthImage(activeUrl);

  const zoomBy = useCallback((delta: number) => {
    setScale((current) => Math.min(6, Math.max(1, current + delta)));
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      zoomBy(event.deltaY > 0 ? -0.25 : 0.25);
    },
    [zoomBy],
  );

  const onPointerDown = (event: React.PointerEvent) => {
    if (scale <= 1) return;
    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragState.current;
    if (!drag) return;
    setOffset({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    });
  };

  const onPointerUp = () => {
    dragState.current = null;
  };

  return (
    <div className={cn('overflow-hidden rounded-lg border border-slate-200 bg-slate-950', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
        <div className="flex rounded-md bg-slate-800 p-0.5" role="group" aria-label="Image variant">
          <button
            type="button"
            onClick={() => setVariant('annotated')}
            disabled={!annotatedUrl}
            aria-pressed={variant === 'annotated'}
            className={cn(
              'rounded px-3 py-1 text-xs font-medium transition-colors',
              variant === 'annotated'
                ? 'bg-white text-slate-900'
                : 'text-slate-300 hover:text-white disabled:opacity-40',
            )}
          >
            AI annotated
          </button>
          <button
            type="button"
            onClick={() => setVariant('original')}
            aria-pressed={variant === 'original'}
            className={cn(
              'rounded px-3 py-1 text-xs font-medium transition-colors',
              variant === 'original'
                ? 'bg-white text-slate-900'
                : 'text-slate-300 hover:text-white',
            )}
          >
            Original
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => zoomBy(-0.5)}
            className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <Minus size={15} />
          </button>
          <span className="tabular w-12 text-center text-xs text-slate-400">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => zoomBy(0.5)}
            className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <Plus size={15} />
          </button>
          <button
            type="button"
            aria-label="Reset view"
            onClick={reset}
            className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* Image stage */}
      <div
        className="relative flex aspect-video items-center justify-center overflow-hidden select-none"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ cursor: scale > 1 ? 'grab' : 'default' }}
      >
        {loading ? (
          <Spinner size="lg" label="Loading image" className="border-slate-600 border-t-brand-400" />
        ) : error || !src ? (
          <p className="text-sm text-slate-400">Image unavailable.</p>
        ) : (
          <div
            className="relative"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transition: dragState.current ? 'none' : 'transform 150ms ease-out',
            }}
          >
            <img
              src={src}
              alt={variant === 'annotated' ? 'AI annotated road image' : 'Original road image'}
              className="max-h-[60vh] w-auto max-w-full"
              draggable={false}
            />
            {/* Hover highlight — relative to the natural image size */}
            {hoveredIndex != null && detections[hoveredIndex] && variant === 'annotated' ? (
              <DetectionOverlay
                detection={detections[hoveredIndex]}
                imageWidth={imageWidth}
                imageHeight={imageHeight}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function DetectionOverlay({
  detection,
  imageWidth,
  imageHeight,
}: {
  detection: Detection;
  imageWidth: number;
  imageHeight: number;
}) {
  const { bbox } = detection;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: `${(bbox.x1 / imageWidth) * 100}%`,
        top: `${(bbox.y1 / imageHeight) * 100}%`,
        width: `${((bbox.x2 - bbox.x1) / imageWidth) * 100}%`,
        height: `${((bbox.y2 - bbox.y1) / imageHeight) * 100}%`,
        border: `2px solid ${classColor(detection.className)}`,
        background: `${classColor(detection.className)}22`,
        boxShadow: `0 0 0 2px #0f172a`,
      }}
    >
      <span
        className="absolute -top-6 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
        style={{ backgroundColor: classColor(detection.className) }}
      >
        {classLabel(detection.className)} · {(detection.confidence * 100).toFixed(0)}%
      </span>
    </div>
  );
}

export function ImagePlaceholder({ icon }: { icon?: React.ReactNode }) {
  return (
    <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400">
      {icon ?? <Maximize2 size={24} />}
    </div>
  );
}
