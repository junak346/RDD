import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  ClipboardList,
  Flame,
  Layers3,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  ScrollText,
  Settings2,
  ShieldCheck,
  UsersRound,
  Warehouse,
  X,
} from 'lucide-react';

import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { officialService } from '../../services/official.service';
import { roleAllows, useOfficialAuth } from '../../stores/officialAuth';
import { GovernmentRole } from '../../types';
import { cn } from '../../utils/cn';

import { DemoBanner } from './DemoBanner';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: GovernmentRole[];
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/official', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/official/reports', label: 'Reports', icon: ClipboardList },
  { to: '/official/map', label: 'Command map', icon: MapIcon },
  { to: '/official/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/official/hotspots', label: 'Reported hotspots', icon: Flame },
  { to: '/official/incidents', label: 'Grouped incidents', icon: Layers3 },
  { to: '/official/notifications', label: 'Notifications', icon: Bell },
  { to: '/official/audit', label: 'Audit log', icon: ScrollText },
  {
    to: '/official/admin',
    label: 'Administration',
    icon: Settings2,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    to: '/official/departments',
    label: 'Departments',
    icon: Warehouse,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    to: '/official/officials',
    label: 'Officials',
    icon: UsersRound,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
];

export function OfficialLayout({ children }: { children: React.ReactNode }) {
  const { official, logout } = useOfficialAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const notifications = useQuery({
    queryKey: ['official-notifications'],
    queryFn: officialService.notifications,
    enabled: Boolean(official),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    document.title = 'Command Center · RoadVision';
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex, nofollow, noarchive';
  }, []);

  if (!official) return <div className="flex min-h-screen items-center justify-center"><Spinner size="lg" /></div>;

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || roleAllows(official, item.roles));
  const notificationCount =
    (notifications.data?.newHighPriorityReports ?? 0) + (notifications.data?.overdueReports ?? 0);

  const onLogout = async () => {
    await logout();
    navigate('/official-access', { replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas">
      <DemoBanner />
      <div className="flex min-h-screen">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-slate-950 text-slate-200 transition-transform lg:static lg:translate-x-0',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
                <ShieldCheck size={19} aria-hidden />
              </span>
              <div>
                <p className="text-sm font-bold tracking-wide text-white">RoadVision</p>
                <p className="text-[10px] uppercase tracking-widest text-brand-300">Command Center</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-md p-2 text-slate-300 hover:bg-white/10 lg:hidden"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Official navigation">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-brand-600/25 text-white ring-1 ring-inset ring-brand-500/30' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                  )
                }
              >
                <item.icon size={17} aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-white/10 p-4">
            <p className="truncate text-sm font-semibold text-white">{official.name}</p>
            <p className="mt-0.5 text-xs text-slate-400">{official.role.replace(/_/g, ' ')} · {official.department}</p>
            <Button variant="ghost" className="mt-3 w-full justify-start text-slate-300 hover:bg-white/10 hover:text-white" icon={<LogOut size={16} />} onClick={() => void onLogout()}>
              Secure logout
            </Button>
          </div>
        </aside>

        {open ? (
          <button type="button" aria-label="Close navigation overlay" className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setOpen(false)} />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Open navigation"
              >
                <Menu size={20} />
              </button>
              <div>
                <p className="text-sm font-semibold text-slate-900">Government operations</p>
                <p className="text-xs text-slate-500">Evidence · verification · assignment · resolution</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NavLink to="/official/notifications" className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100" aria-label="Notifications">
                <Bell size={19} />
                {notificationCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {notificationCount}
                  </span>
                ) : null}
              </NavLink>
              <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 sm:inline">
                {official.officialId}
              </span>
            </div>
          </header>
          <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function OfficialPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
