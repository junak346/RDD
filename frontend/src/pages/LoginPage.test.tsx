import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../types';

import { LoginPage } from './LoginPage';

const loginMock = vi.fn();

vi.mock('../stores/auth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: loginMock,
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  it('validates the form before submitting', async () => {
    loginMock.mockReset();
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('submits credentials when valid', async () => {
    loginMock.mockReset();
    loginMock.mockResolvedValue(undefined);
    renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(loginMock).toHaveBeenCalledWith('user@example.com', 'password123');
    expect(screen.queryByText('Enter a valid email address.')).not.toBeInTheDocument();
  });

  it('shows an error alert when sign-in fails', async () => {
    loginMock.mockReset();
    loginMock.mockRejectedValue(new AppError('INVALID_CREDENTIALS', 'Invalid email or password.', 401));
    renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpass1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/sign-in failed/i);
    expect(alert).toHaveTextContent(/invalid email or password/i);
  });
});
