import { DragEvent, useRef, useState } from 'react';
import { ImageUp, X } from 'lucide-react';

import { cn } from '../../utils/cn';
import { formatBytes } from '../../utils/format';

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

interface DropzoneProps {
  file: File | null;
  onFile: (file: File | null) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

/** Drag & drop + file-picker upload area with client-side validation. */
export function Dropzone({ file, onFile, onError, disabled }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const validateAndSet = (candidate: File | null) => {
    if (!candidate) return;
    if (!ACCEPTED_TYPES.includes(candidate.type)) {
      onError('Unsupported format — please upload a JPEG, PNG or WebP image.');
      return;
    }
    if (candidate.size > MAX_UPLOAD_BYTES) {
      onError(`Image is ${formatBytes(candidate.size)} — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
      return;
    }
    onFile(candidate);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    validateAndSet(event.dataTransfer.files?.[0] ?? null);
  };

  if (file) {
    return (
      <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <img
          src={URL.createObjectURL(file)}
          alt="Selected road image preview"
          className="h-20 w-28 rounded-md border border-slate-200 object-cover"
          onLoad={(event) => URL.revokeObjectURL((event.target as HTMLImageElement).src)}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
          <p className="tabular mt-0.5 text-xs text-slate-500">
            {formatBytes(file.size)} · {file.type.replace('image/', '').toUpperCase()}
          </p>
        </div>
        {!disabled ? (
          <button
            type="button"
            aria-label="Remove selected image"
            onClick={() => onFile(null)}
            className="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload a road image"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !disabled) inputRef.current?.click();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors',
        dragging
          ? 'border-brand-500 bg-brand-50'
          : 'border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/40',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <ImageUp size={22} />
      </div>
      <p className="mt-4 text-sm font-medium text-slate-800">
        Drag &amp; drop a road image, or click to browse
      </p>
      <p className="mt-1 text-xs text-slate-500">
        JPEG, PNG or WebP · up to {formatBytes(MAX_UPLOAD_BYTES)}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={(event) => {
          validateAndSet(event.target.files?.[0] ?? null);
          event.target.value = '';
        }}
      />
    </div>
  );
}
