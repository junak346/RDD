import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { accountService } from '../services/auth.service';
import { AppError } from '../types';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError('Use at least 8 characters with letters and a number.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await accountService.resetPassword(token, password);
      setDone(true);
      window.setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err instanceof AppError ? err.message : 'Reset failed — please request a new link.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="surface-card p-8">
        <h1 className="text-xl font-semibold text-slate-900">Choose a new password</h1>

        {!token ? (
          <Alert tone="warning" className="mt-5" title="Missing reset token">
            This page needs a valid reset link. Request a new one from the{' '}
            <Link className="font-medium underline" to="/forgot-password">
              forgot-password page
            </Link>
            .
          </Alert>
        ) : done ? (
          <Alert tone="success" className="mt-5" title="Password updated">
            You can now sign in with your new password — redirecting…
          </Alert>
        ) : (
          <>
            {error ? (
              <Alert tone="danger" className="mt-5" title="Reset failed">
                {error}
              </Alert>
            ) : null}
            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              <Input
                label="New password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                hint="At least 8 characters, including letters and a number."
                onChange={(event) => setPassword(event.target.value)}
              />
              <Input
                label="Confirm new password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
              <Button type="submit" className="w-full" loading={submitting} disabled={!token}>
                Update password
              </Button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
