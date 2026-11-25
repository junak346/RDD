import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { PublicLayout } from '../components/layout/PublicLayout';

import { LandingPage } from './LandingPage';

describe('public citizen navigation', () => {
  it('does not advertise the hidden government portal or legacy account CTAs', () => {
    const { container } = render(
      <MemoryRouter>
        <PublicLayout><p>Public citizen content</p></PublicLayout>
      </MemoryRouter>,
    );

    expect(screen.getByText('Public citizen content')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /government login/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /get started/i })).not.toBeInTheDocument();
    const hrefs = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(hrefs.some((href) => href?.includes('/official-access') || href?.includes('/official'))).toBe(false);
    expect(screen.getByRole('link', { name: /report road damage/i })).toHaveAttribute('href', '/report');
    expect(screen.getByRole('link', { name: /check report status/i })).toHaveAttribute('href', '/track');
  });

  it('uses the camera CTA and contains no file input, gallery or drag/drop path on the landing page', () => {
    const { container } = render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /see it\. capture it\. report it\./i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /report road damage/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /check report status/i }).length).toBeGreaterThan(0);
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByText(/drag.*drop|browse files|select gallery/i)).not.toBeInTheDocument();
    const hrefs = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(hrefs.some((href) => href?.includes('/official-access') || href?.includes('/official'))).toBe(false);
  });
});
