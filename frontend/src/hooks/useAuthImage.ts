import { useEffect, useState } from 'react';

import { getStoredToken } from '../services/api';

/**
 * Images behind the authenticated API cannot be used directly in <img src>
 * (no Authorization header), so they are fetched as blobs and exposed as
 * object URLs. Small in-memory cache avoids refetching while navigating.
 */
const cache = new Map<string, string>();

export function useAuthImage(url: string | null | undefined): {
  src: string | null;
  loading: boolean;
  error: boolean;
} {
  const [src, setSrc] = useState<string | null>(() => (url && cache.get(url)) || null);
  const [loading, setLoading] = useState(Boolean(url && !cache.get(url)));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) {
      setSrc(null);
      setLoading(false);
      return;
    }
    const cached = cache.get(url);
    if (cached) {
      setSrc(cached);
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(false);

    fetch(url, {
      headers: { Authorization: `Bearer ${getStoredToken() ?? ''}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`image fetch failed: ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        cache.set(url, objectUrl);
        setSrc(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return { src, loading, error };
}
