import { useCallback, useEffect, useRef, useState } from 'react';

export interface CapturedPhoto {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  size: number;
  capturedAt: string;
}

/** Long edge cap preserves road-damage detail while keeping uploads practical. */
export const MAX_CAPTURE_DIMENSION = 1920;
export const CAPTURE_JPEG_QUALITY = 0.88;

function secureBrowserContext(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location?.hostname ?? '';
  return window.isSecureContext === true || host === 'localhost' || host === '127.0.0.1';
}

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'Camera access was blocked. Please allow camera access in your browser settings to report road damage.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return 'No compatible camera was found on this device.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera is unavailable. Close other apps using it and try again.';
  }
  if (name === 'AbortError') {
    return 'Camera access was cancelled. No photo was captured.';
  }
  return 'Camera access could not be started. Please check browser permissions and try again.';
}

/**
 * Maintained getUserMedia camera workflow. It captures only a fresh frame from
 * the live stream — there is deliberately no file input or gallery picker.
 */
export function useCameraCapture() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (!secureBrowserContext()) {
      setError('Camera access requires HTTPS. Please open the site over a secure connection.');
      return false;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support camera capture. Please use a modern browser with getUserMedia support.');
      return false;
    }
    setStarting(true);
    setError(null);
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = nextStream;
      setStream(nextStream);
      return true;
    } catch (requestError) {
      setError(cameraErrorMessage(requestError));
      return false;
    } finally {
      setStarting(false);
    }
  }, []);

  const capture = useCallback(async (): Promise<CapturedPhoto | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError('The camera preview is not ready yet. Please wait a moment and try again.');
      return null;
    }
    const scale = Math.min(
      1,
      MAX_CAPTURE_DIMENSION / Math.max(video.videoWidth, video.videoHeight),
    );
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      setError('This browser could not prepare the photo. Please try a different browser.');
      return null;
    }
    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', CAPTURE_JPEG_QUALITY);
    });
    if (!blob) {
      setError('The photo could not be prepared. Please retake it.');
      return null;
    }
    const next: CapturedPhoto = {
      blob,
      previewUrl: URL.createObjectURL(blob),
      width,
      height,
      size: blob.size,
      capturedAt: new Date().toISOString(),
    };
    setPhoto(next);
    setError(null);
    return next;
  }, []);

  const clearPhoto = useCallback(() => {
    setPhoto((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }, []);

  const retake = useCallback(async (): Promise<boolean> => {
    clearPhoto();
    if (!streamRef.current || streamRef.current.getTracks().every((track) => track.readyState === 'ended')) {
      return start();
    }
    return true;
  }, [clearPhoto, start]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.previewUrl);
    };
  }, [photo]);

  return { videoRef, stream, starting, error, photo, start, stop, capture, clearPhoto, retake };
}
