import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError, PublicReportStatus } from '../types';

import { CameraReportPage } from './CameraReportPage';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  status: vi.fn(),
  rememberReportId: vi.fn(),
  getPosition: vi.fn(),
  getUserMedia: vi.fn(),
  stopTrack: vi.fn(),
}));

vi.mock('../services/reports.service', () => ({
  reportsService: {
    create: mocks.create,
    status: mocks.status,
    config: vi.fn(),
    rememberReportId: mocks.rememberReportId,
    rememberedReportId: () => '',
  },
}));

const reportFixture: PublicReportStatus = {
  publicReportId: 'RVR-2026-ABCDEFGHJK',
  submittedAt: new Date().toISOString(),
  lastUpdatedAt: new Date().toISOString(),
  status: 'AI_ANALYSED',
  generalLocation: { area: 'Approximate area 26.1°, 91.7°', precision: 'coarse', accuracyMeters: 12 },
  detectedDamageType: 'pothole',
  severity: 'high',
  confidence: 0.91,
  noDamageDetected: false,
  aiPending: false,
  aiDemo: true,
  timeline: [
    { key: 'SUBMITTED', label: 'Submitted', state: 'complete' },
    { key: 'AI_ANALYSED', label: 'AI analysed', state: 'current' },
    { key: 'UNDER_REVIEW', label: 'Under review', state: 'pending' },
    { key: 'ASSIGNED', label: 'Assigned', state: 'pending' },
    { key: 'IN_PROGRESS', label: 'In progress', state: 'pending' },
    { key: 'RESOLVED', label: 'Resolved', state: 'pending' },
  ],
  message: 'AI detected a likely pothole.',
};

const originalGeolocation = navigator.geolocation;
const originalMediaDevices = navigator.mediaDevices;
const originalSecure = window.isSecureContext;
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToBlob = HTMLCanvasElement.prototype.toBlob;
const originalPlay = HTMLVideoElement.prototype.play;

function freshPosition(): GeolocationPosition {
  return {
    coords: {
      latitude: 26.1445,
      longitude: 91.7362,
      accuracy: 12,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  } as GeolocationPosition;
}

function permissionDenied(): GeolocationPositionError {
  return {
    code: 1,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
    message: 'denied',
  } as GeolocationPositionError;
}

function renderFlow() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/report']}>
        <Routes>
          <Route path="/report" element={<CameraReportPage />} />
          <Route path="/report/success/:publicId" element={<div>Report success</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function reachConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /continue/i }));
  await screen.findByLabelText('Live camera preview');
  await user.click(screen.getByRole('button', { name: 'Capture photo' }));
  await screen.findByRole('heading', { name: 'Photo preview' });
  await user.click(screen.getByRole('button', { name: /confirm photo/i }));
  return screen.findByRole('button', { name: /submit road report/i });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue(reportFixture);
  mocks.getPosition.mockImplementation((success: PositionCallback) => success(freshPosition()));
  mocks.getUserMedia.mockImplementation(async () => ({
    getTracks: () => [{ stop: mocks.stopTrack, readyState: 'live' }],
  }) as unknown as MediaStream);

  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: mocks.getPosition },
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: mocks.getUserMedia },
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    configurable: true,
    writable: true,
    value: null,
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
    configurable: true,
    get: () => 1920,
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
    configurable: true,
    get: () => 1080,
  });
  HTMLVideoElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback, type?: string) => {
    callback(new Blob(['fresh-camera-photo'], { type: type ?? 'image/jpeg' }));
  }) as unknown as typeof HTMLCanvasElement.prototype.toBlob;
});

afterEach(() => {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: originalGeolocation });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: originalMediaDevices });
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: originalSecure });
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toBlob = originalToBlob;
  HTMLVideoElement.prototype.play = originalPlay;
  vi.restoreAllMocks();
});

describe('CameraReportPage citizen flow', () => {
  it('explains permissions, has no file upload/gallery path, and submits only after photo + GPS confirmation', async () => {
    const user = userEvent.setup();
    renderFlow();

    expect(screen.getByRole('heading', { name: 'Report road damage' })).toBeInTheDocument();
    expect(screen.getByText('Permissions needed')).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByText(/browse files|drag.*drop|select gallery/i)).not.toBeInTheDocument();
    expect(mocks.getPosition).not.toHaveBeenCalled();
    expect(mocks.getUserMedia).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByLabelText('Live camera preview');
    expect(mocks.getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false }));
    expect(mocks.getPosition).toHaveBeenCalledOnce();
    expect(mocks.create).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Capture photo' }));
    await screen.findByRole('heading', { name: 'Photo preview' });
    expect(mocks.create).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /retake/i }));
    await screen.findByLabelText('Live camera preview');
    await user.click(screen.getByRole('button', { name: 'Capture photo' }));
    await screen.findByRole('heading', { name: 'Photo preview' });
    await user.click(screen.getByRole('button', { name: /confirm photo/i }));
    const submit = await screen.findByRole('button', { name: /submit road report/i });
    expect(mocks.create).not.toHaveBeenCalled();

    await user.click(submit);
    await screen.findByText('Report success');

    expect(mocks.create).toHaveBeenCalledOnce();
    const [image, location] = mocks.create.mock.calls[0] as [Blob, Record<string, unknown>];
    expect(image).toBeInstanceOf(Blob);
    expect(image.type).toBe('image/jpeg');
    expect(location).toMatchObject({ latitude: 26.1445, longitude: 91.7362, accuracy: 12 });
    expect(location.capturedAt).toBeTruthy();
    expect(mocks.rememberReportId).toHaveBeenCalledWith(reportFixture.publicReportId);
    expect(mocks.stopTrack).toHaveBeenCalled();
  });

  it('requires location and disables confirmation when GPS permission is denied', async () => {
    const user = userEvent.setup();
    mocks.getPosition.mockImplementation((_success: PositionCallback, error: PositionErrorCallback) => {
      error(permissionDenied());
    });
    renderFlow();

    await user.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByLabelText('Live camera preview');
    expect((await screen.findAllByText(/Location access is required to report road damage/)).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Capture photo' }));
    const confirm = await screen.findByRole('button', { name: /confirm photo/i });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole('button', { name: /enable location/i })).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('shows a clear rate-limit error and keeps the citizen on the confirmation screen', async () => {
    const user = userEvent.setup();
    mocks.create.mockRejectedValueOnce(
      new AppError('RATE_LIMITED', 'Too many reports. Please wait before trying again.', 429),
    );
    renderFlow();

    const submit = await reachConfirm(user);
    await user.click(submit);

    expect((await screen.findAllByText('Too many reports. Please wait before trying again.')).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByText('Report success')).not.toBeInTheDocument());
    expect(mocks.create).toHaveBeenCalledOnce();
  });
});
