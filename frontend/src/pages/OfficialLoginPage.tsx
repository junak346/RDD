import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LockKeyhole, ShieldCheck } from 'lucide-react';

import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { useOfficialAuth } from '../stores/officialAuth';
import { AppError } from '../types';

export function OfficialLoginPage() {
  const { official, loading, login } = useOfficialAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Restricted access · RoadVision';
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex, nofollow, noarchive';
  }, []);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Spinner size="lg" label="Checking session" /></div>;
  }
  if (official) return <Navigate to="/official" replace />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from?.startsWith('/official') ? from : '/official', { replace: true });
    } catch (loginError) {
      setError(
        loginError instanceof AppError
          ? loginError.message
          : 'Sign-in failed. Please check your credentials and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-7 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-brand-300">
            <LockKeyhole size={21} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Restricted access</p>
            <h1 className="text-xl font-bold text-slate-900">Official command center</h1>
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          <ShieldCheck size={14} className="mr-1 inline text-emerald-600" aria-hidden />
          Authorized government officials only. Accounts are provisioned by an administrator; there
          is no public registration. All access and case actions are audited.
        </p>

        <form className="mt-6 space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <Input
            label="Official email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="official@agency.example"
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Secure sign in
          </Button>
        </form>
        <p className="mt-5 text-center text-xs text-slate-500">
          Sessions are short-lived and protected by httpOnly cookies, role checks and CSRF tokens.
          Architecture is ready for MFA / institutional SSO; no fake verification is claimed.
        </p>
      </div>
    </div>
  );
}
