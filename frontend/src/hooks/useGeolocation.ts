import { useCallback, useState } from 'react';

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

interface GeolocationState {
  location: GeoLocation | null;
  loading: boolean;
  error: string | null;
  supported: boolean;
  capture: () => void;
  reset: () => void;
}

/** Browser geolocation capture — optional, never required for analysis. */
export function useGeolocation(): GeolocationState {
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(() => {
    if (!supported) {
      setError('Geolocation is not supported by this browser.');
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLoading(false);
      },
      (geoError) => {
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? 'Location permission was denied — you can continue without it.'
            : 'Could not determine your location — you can continue without it.',
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, [supported]);

  const reset = useCallback(() => {
    setLocation(null);
    setError(null);
  }, []);

  return { location, loading, error, supported, capture, reset };
}
