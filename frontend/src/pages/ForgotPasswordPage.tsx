import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';

import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { accountService } from '../services/auth.service';
import { AppError } from '../types';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devResetToken, setDevResetToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await accountService.forgotPassword(email);
      setSent(true);
      // Only ever present when the backend runs EXPOSE_RESET_TOKENS (dev/test).
      setDevResetToken(result.resetToken ?? null);
    } catch (err) {
      setError(err instanceof AppError ? err.message : 'Request failed — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="surface-card p-8">
        <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your account email and we will send you a reset link.
        </p>

        {error ? (
          <Alert tone="danger" className="mt-5" title="Request failed">
            {error}
          </Alert>
        ) : null}

        {sent ? (
          <div className="mt-6 space-y-4">
            <Alert tone="success" title="Check your inbox">
              If an account exists for <strong>{email}</strong>, a reset link has been sent. The
              link expires in 30 minutes.
            </Alert>
            {devResetToken ? (
              <Alert tone="info" title="Development mode">
                Email delivery is simulated in this environment.{' '}
                <Link
                  className="font-medium text-brand-700 underline"
                  to={`/reset-password?token=${devResetToken}`}
                >
                  Open the reset link directly
                </Link>
                .
              </Alert>
            ) : null}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button type="submit" className="w-full" loading={submitting}>
              Send reset link
            </Button>
          </form>
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
