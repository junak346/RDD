import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../stores/auth';
import { AppError } from '../types';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      errors.password = 'Use at least 8 characters with letters and a number.';
    }
    if (confirm !== password) errors.confirm = 'Passwords do not match.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register(name.trim(), email, password);
      navigate('/app', { replace: true });
    } catch (error) {
      if (error instanceof AppError && error.details?.length) {
        const mapped: Record<string, string> = {};
        for (const detail of error.details) mapped[detail.field] = detail.message;
        setFieldErrors(mapped);
      }
      setFormError(
        error instanceof AppError ? error.message : 'Registration failed — please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="surface-card p-8">
        <h1 className="text-xl font-semibold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Start analysing road damage with computer vision in minutes.
        </p>

        {formError ? (
          <Alert tone="danger" className="mt-5" title="Registration failed">
            {formError}
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <Input
            label="Full name"
            name="name"
            autoComplete="name"
            value={name}
            error={fieldErrors.name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            error={fieldErrors.email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            error={fieldErrors.password}
            hint="At least 8 characters, including letters and a number."
            onChange={(event) => setPassword(event.target.value)}
          />
          <Input
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirm}
            error={fieldErrors.confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
          <Button type="submit" className="w-full" loading={submitting}>
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
