import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRequiredGeolocation } from './useRequiredGeolocation';

describe('useRequiredGeolocation', () => {
  const originalGeolocation = navigator.geolocation;
  const originalSecure = window.isSecureContext;

  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    });
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: originalSecure,
    });
    vi.restoreAllMocks();
  });

  it('requests explicit high-accuracy GPS only when capture is invoked', () => {
    const getCurrentPosition = vi.fn(
      (...args: Parameters<Geolocation['getCurrentPosition']>) => {
        const [success] = args;
        success({
          coords: {
            latitude: 26.1445,
            longitude: 91.7362,
            accuracy: 12,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
      },
    );
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    const { result } = renderHook(() => useRequiredGeolocation());
    expect(getCurrentPosition).not.toHaveBeenCalled();

    act(() => result.current.capture());

    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(getCurrentPosition.mock.calls[0][2]).toMatchObject({
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.location).toMatchObject({
      latitude: 26.1445,
      longitude: 91.7362,
      accuracy: 12,
    });
    expect(result.current.location?.capturedAt).toBeTruthy();
  });

  it('never silently submits a report when location permission is denied', () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
      error({
        code: 1,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: 'denied',
      } as GeolocationPositionError);
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    const { result } = renderHook(() => useRequiredGeolocation());
    act(() => result.current.capture());

    expect(result.current.status).toBe('error');
    expect(result.current.location).toBeNull();
    expect(result.current.error).toContain('Location access is required to report road damage.');
  });

  it('reports unsupported browsers instead of silently falling back to a guess', () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useRequiredGeolocation());
    act(() => result.current.capture());

    expect(result.current.status).toBe('error');
    expect(result.current.location).toBeNull();
    expect(result.current.error).toContain('does not support location access');
  });
});
