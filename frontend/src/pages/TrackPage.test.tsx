import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicReportStatus } from '../types';

import { TrackPage } from './TrackPage';

const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  rememberReportId: vi.fn(),
}));

vi.mock('../services/reports.service', () => ({
  reportsService: {
    create: vi.fn(),
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
  status: 'UNDER_REVIEW',
  generalLocation: { area: 'Approximate area 26.1°, 91.7°', precision: 'coarse', accuracyMeters: 12 },
  detectedDamageType: 'pothole',
  severity: 'moderate',
  confidence: 0.82,
  noDamageDetected: false,
  aiPending: false,
  aiDemo: false,
  timeline: [
    { key: 'SUBMITTED', label: 'Submitted', state: 'complete' },
    { key: 'AI_ANALYSED', label: 'AI analysed', state: 'complete' },
    { key: 'UNDER_REVIEW', label: 'Under review', state: 'current' },
    { key: 'ASSIGNED', label: 'Assigned', state: 'pending' },
    { key: 'IN_PROGRESS', label: 'In progress', state: 'pending' },
    { key: 'RESOLVED', label: 'Resolved', state: 'pending' },
  ],
  message: 'AI detected a likely pothole.',
};

function renderTrack() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/track']}>
        <TrackPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TrackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects guessed/invalid public IDs before calling the public status API', async () => {
    const user = userEvent.setup();
    renderTrack();

    await user.type(screen.getByLabelText('Report ID'), 'not-a-real-id');
    await user.click(screen.getByRole('button', { name: /check status/i }));

    expect(await screen.findByText(/Enter a valid report ID/)).toBeInTheDocument();
    expect(mocks.status).not.toHaveBeenCalled();
  });

  it('shows only the limited public timeline for a valid unguessable report ID', async () => {
    const user = userEvent.setup();
    mocks.status.mockResolvedValue(reportFixture);
    renderTrack();

    await user.type(screen.getByLabelText('Report ID'), 'rvr-2026-abcdefghjk');
    await user.click(screen.getByRole('button', { name: /check status/i }));

    expect(await screen.findByText('Report timeline')).toBeInTheDocument();
    expect(mocks.status).toHaveBeenCalledWith('RVR-2026-ABCDEFGHJK');
    expect(screen.getByText('Under review')).toBeInTheDocument();
    expect(screen.getByText('Approximate area 26.1°, 91.7°')).toBeInTheDocument();
    expect(screen.getByText(/Exact GPS, captured images, internal notes/i)).toBeInTheDocument();
    expect(screen.queryByText('26.1445')).not.toBeInTheDocument();
    expect(screen.queryByText('91.7362')).not.toBeInTheDocument();
    expect(mocks.rememberReportId).toHaveBeenCalledWith(reportFixture.publicReportId);
  });
});
