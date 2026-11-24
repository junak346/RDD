import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  History,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  ScanLine,
  User as UserIcon,
  X,
} from 'lucide-react';

import { useAuth } from '../../stores/auth';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';

import { DemoBanner } from './DemoBanner';

const NAV_ITEMS = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/analyze', label: 'Analyse Image', icon: ScanLine },
  { to: '/app/history', label: 'Inspections', icon: History },
  { to: '/app/map', label: 'Damage Map', icon: MapIcon },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
];

function BrandMark() {
  return (
    <NavLink to="/app" className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-md" />
      <div>
        <p className="text-sm font-semibold leading-tight text-white">RoadDamage AI</p>
        <p className="text-[10px] font-medium uppercase tracking-widest text-brand-300">
          Detection Platform
        </p>
      </div>
    </NavLink>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-brand-600/20 text-white'
                : 'text-slate-300 hover:bg-white/5 hover:text-white',
            )
          }
        >
          <item.icon size={17} aria-hidden />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function UserFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="border-t border-white/10 p-4">
      <NavLink
        to="/app/profile"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-white/5"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          {user?.name?.charAt(0).toUpperCase() ?? '?'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">{user?.name}</span>
          <span className="block truncate text-xs text-slate-400">{user?.email}</span>
        </span>
        <UserIcon size={15} className="text-slate-400" aria-hidden />
      </NavLink>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 w-full justify-start gap-2 text-slate-300 hover:bg-white/5 hover:text-white"
        icon={<LogOut size={15} />}
        onClick={async () => {
          await logout();
          onNavigate?.();
          navigate('/');
        }}
      >
        Sign out
      </Button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-slate-900 lg:flex">
        <div className="px-5 py-5">
          <BrandMark />
        </div>
        <div className="flex-1 px-3">
          <NavLinks />
        </div>
        <UserFooter />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-slate-900 px-4 py-3 lg:hidden">
        <BrandMark />
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-slate-200 hover:bg-white/10"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-slate-900 shadow-panel animate-fade-up">
            <div className="flex items-center justify-between px-5 py-5">
              <BrandMark />
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-2 text-slate-300 hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 px-3">
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </div>
            <UserFooter onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <DemoBanner />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

/** Page heading used across app pages for consistent hierarchy. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
