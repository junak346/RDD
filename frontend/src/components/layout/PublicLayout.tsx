import { Link, NavLink } from 'react-router-dom';

import { useAuth } from '../../stores/auth';
import { Button } from '../ui/Button';

import { DemoBanner } from './DemoBanner';

/** Top navigation + footer shared by the landing and auth pages. */
export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <DemoBanner />
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-md" />
            <div>
              <p className="text-sm font-semibold leading-tight text-slate-900">RoadDamage AI</p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-brand-600">
                Detection Platform
              </p>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            {user ? (
              <Link to="/app">
                <Button size="sm">Open dashboard</Button>
              </Link>
            ) : (
              <>
                <NavLink to="/login">
                  <Button size="sm" variant="ghost">
                    Sign in
                  </Button>
                </NavLink>
                <NavLink to="/register">
                  <Button size="sm">Get started</Button>
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-6 w-6 rounded" />
            <p>
              <span className="font-medium text-slate-700">RoadDamage AI</span> — computer-vision
              road damage analysis.
            </p>
          </div>
          <p className="max-w-xl text-xs leading-relaxed">
            AI results are assistive estimates, not professional civil-engineering assessments.
            Always verify critical findings on site.
          </p>
        </div>
      </footer>
    </div>
  );
}
