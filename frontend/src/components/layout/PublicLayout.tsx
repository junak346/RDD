import { Link } from 'react-router-dom';

import { DemoBanner } from './DemoBanner';

/** Citizen-facing navigation. Deliberately contains no login, registration or
 *  government-portal links. The official portal is private and unadvertised. */
export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <DemoBanner />
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5" aria-label="RoadVision home">
            <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-md" />
            <div>
              <p className="text-sm font-semibold leading-tight text-slate-900">RoadVision</p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-brand-600">
                Civic Road Reporting
              </p>
            </div>
          </Link>
          <nav className="flex items-center gap-2" aria-label="Public navigation">
            <Link
              to="/track"
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
            >
              Check report status
            </Link>
            <Link
              to="/report"
              className="inline-flex items-center rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              Report road damage
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-6 w-6 rounded" />
            <p><span className="font-medium text-slate-700">RoadVision</span> — see it, capture it, report it.</p>
          </div>
          <p className="max-w-xl text-xs leading-relaxed">
            AI results are assistive estimates, not a guarantee that a road is damaged. Exact locations
            are restricted to authorized officials; public tracking shows only limited information.
          </p>
        </div>
      </footer>
    </div>
  );
}
