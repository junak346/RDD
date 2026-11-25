import { useCallback, useState } from 'react';

export interface RequiredGeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
}

export type GeolocationStatus = 'idle' | 'requesting' | 'ready' | 'error';

function secureBrowserContext(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location?.hostname ?? '';
  return window.isSecureContext === true || host === 'localhost' || host === '127.0.0.1';
}

/**
 * Explicit, required browser GPS capture for citizen reports. No position is
 * requested until the citizen presses Continue / Enable Location.
 */
export function useRequiredGeolocation() {
  const [location, setLocation] = useState<RequiredGeoLocation | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback((): void => {
    if (!secureBrowserContext()) {
      setStatus('error');
      setError('Location access requires HTTPS. Please open the site over a secure connection.');
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('error');
      setError('This browser does not support location access. Please use a browser with Geolocation API support.');
      return;
    }

    setStatus('requesting');
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
        });
        setStatus('ready');
        setError(null);
      },
      (geoError) => {
        setLocation(null);
        setStatus('error');
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setError(
            'Location access is required to report road damage. Please allow location access in your browser settings so the damage can be mapped.',
          );
        } else if (geoError.code === geoError.TIMEOUT) {
          setError('Location could not be determined in time. Please try again in an open area.');
        } else {
          setError('Location is currently unavailable. Please check your device settings and try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }, []);

  const reset = useCallback(() => {
    setLocation(null);
    setStatus('idle');
    setError(null);
  }, []);

  return { location, status, error, capture, reset };
}
