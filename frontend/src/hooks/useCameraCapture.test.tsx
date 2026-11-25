import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CAPTURE_JPEG_QUALITY,
  MAX_CAPTURE_DIMENSION,
  useCameraCapture,
  type CapturedPhoto,
} from './useCameraCapture';

describe('useCameraCapture', () => {
  const originalMediaDevices = navigator.mediaDevices;
  const originalSecure = window.isSecureContext;
  let stopTrack: ReturnType<typeof vi.fn>;
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      configurable: true,
      writable: true,
      value: null,
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
      configurable: true,
      get: () => 2400,
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
      configurable: true,
      get: () => 1200,
    });
    HTMLVideoElement.prototype.play = vi.fn(() => Promise.resolve());

    const drawImage = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback, type?: string) => {
      callback(new Blob(['captured-jpeg'], { type: type ?? 'image/jpeg' }));
    }) as unknown as typeof HTMLCanvasElement.prototype.toBlob;

    stopTrack = vi.fn();
    getUserMedia = vi.fn(async () => ({
      getTracks: () => [{ stop: stopTrack, readyState: 'live' }],
    }) as unknown as MediaStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    });
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: originalSecure,
    });
    vi.restoreAllMocks();
  });

  function attachVideo(result: { current: ReturnType<typeof useCameraCapture> }) {
    const video = document.createElement('video');
    result.current.videoRef.current = video;
    return video;
  }

  it('uses maintained getUserMedia and captures a fresh, resized JPEG frame', async () => {
    const { result } = renderHook(() => useCameraCapture());
    const video = attachVideo(result);

    await act(async () => {
      const ready = await result.current.start();
      expect(ready).toBe(true);
    });

    expect(getUserMedia).toHaveBeenCalledWith({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    expect(video.srcObject).toBeTruthy();

    await act(async () => {
      const photo: CapturedPhoto | null = await result.current.capture();
      expect(photo).not.toBeNull();
      expect(photo?.width).toBe(MAX_CAPTURE_DIMENSION);
      expect(photo?.height).toBe(960);
      expect(photo?.blob.type).toBe('image/jpeg');
    });
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      CAPTURE_JPEG_QUALITY,
    );
  });

  it('retakes by clearing the preview and stops camera tracks on cleanup', async () => {
    const { result } = renderHook(() => useCameraCapture());
    attachVideo(result);

    await act(async () => {
      expect(await result.current.start()).toBe(true);
      expect(await result.current.capture()).not.toBeNull();
    });
    expect(result.current.photo).not.toBeNull();

    await act(async () => {
      expect(await result.current.retake()).toBe(true);
    });
    expect(result.current.photo).toBeNull();

    act(() => result.current.stop());
    expect(stopTrack).toHaveBeenCalled();
  });

  it('reports camera denial and invalid capture output without silently submitting', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    getUserMedia.mockRejectedValueOnce(denied);
    const { result } = renderHook(() => useCameraCapture());

    await act(async () => {
      expect(await result.current.start()).toBe(false);
    });
    expect(result.current.error).toContain('Camera access was blocked.');

    getUserMedia.mockResolvedValueOnce({
      getTracks: () => [{ stop: stopTrack, readyState: 'live' }],
    } as unknown as MediaStream);
    await act(async () => {
      expect(await result.current.start()).toBe(true);
    });

    HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => {
      callback(null);
    }) as unknown as typeof HTMLCanvasElement.prototype.toBlob;
    attachVideo(result);

    await act(async () => {
      expect(await result.current.capture()).toBeNull();
    });
    expect(result.current.error).toContain('photo could not be prepared');
  });
});
