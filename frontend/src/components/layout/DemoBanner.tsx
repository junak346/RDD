import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import { onApiMeta } from '../../services/api';
import { ResponseMeta } from '../../types';

/**
 * Persistent, honest banner shown whenever the backend reports demo data
 * mode. Real (MongoDB) data mode shows nothing.
 */
export function DemoBanner() {
  const [meta, setMeta] = useState<ResponseMeta | null>(null);

  useEffect(() => onApiMeta(setMeta), []);

  if (meta?.dataMode !== 'demo') return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-center text-xs font-semibold text-amber-950"
    >
      <AlertTriangle size={13} aria-hidden />
      <span>
        DEMO MODE — the in-memory demo store is active. Data shown is synthetic and resets on
        restart. Set <code className="rounded bg-amber-600/20 px-1">DATA_MODE=mongo</code> for real
        data.
      </span>
    </div>
  );
}
