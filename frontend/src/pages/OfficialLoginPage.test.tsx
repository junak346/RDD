import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../types';

import { OfficialLoginPage } from './OfficialLoginPage';

const mocks = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock('../stores/officialAuth', () => ({
  useOfficialAuth: () => ({
    official: null,
    loading: false,
    login: mocks.login,
    logout: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('OfficialLoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a wrong-password error without claiming government verification', async () => {
    const user = userEvent.setup();
    mocks.login.mockRejectedValueOnce(
      new AppError('INVALID_CREDENTIALS', 'Invalid email or password.', 401),
    );

    render(
      <MemoryRouter>
        <OfficialLoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Official command center' })).toBeInTheDocument();
    expect(screen.getByText(/no public registration/i)).toBeInTheDocument();
    expect(screen.getByText(/no fake verification is claimed/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Official email'), 'official@agency.example');
    await user.type(screen.getByLabelText('Password'), 'WrongPass!2026');
    await user.click(screen.getByRole('button', { name: /secure sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or password/i);
    expect(mocks.login).toHaveBeenCalledWith('official@agency.example', 'WrongPass!2026');
  });
});
