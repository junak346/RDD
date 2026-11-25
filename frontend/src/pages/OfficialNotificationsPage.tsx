import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BellRing, Clock3, Flame, UserCheck } from 'lucide-react';

import { OfficialLayout, OfficialPageHeader } from '../components/layout/OfficialLayout';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { officialService } from '../services/official.service';
import { roleAllows, useOfficialAuth } from '../stores/officialAuth';
import { formatDateTime } from '../utils/format';

export function OfficialNotificationsPage() {
  const { official } = useOfficialAuth();
  const notifications = useQuery({ queryKey: ['official-notifications'], queryFn: officialService.notifications });
  const canViewEvents = roleAllows(official, ['SUPER_ADMIN', 'ADMIN']);
  const events = useQuery({
    queryKey: ['official-events'],
    queryFn: () => officialService.events(50),
    enabled: canViewEvents,
    retry: false,
  });

  const data = notifications.data;
  const cards = [
    { label: 'New high-priority reports', value: data?.newHighPriorityReports ?? 0, icon: Flame, tone: 'bg-red-50 text-red-700' },
    { label: 'Overdue reports', value: data?.overdueReports ?? 0, icon: Clock3, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Assigned to you', value: data?.assignedToMe ?? 0, icon: UserCheck, tone: 'bg-sky-50 text-sky-700' },
    { label: 'New reports', value: data?.newReports ?? 0, icon: BellRing, tone: 'bg-brand-50 text-brand-700' },
  ];

  return (
    <OfficialLayout>
      <OfficialPageHeader
        title="Notification center"
        description="Internal counts derived from stored reports and assignments. No SMS or email delivery is claimed."
        actions={<Link to="/official/reports"><Button>Open reports</Button></Link>}
      />

      <Alert tone="info" className="mb-6" title="Real-time ready">
        Domain events are published internally for future WebSocket/SSE adapters. This page does not
        pretend that external notifications were sent.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-lg border border-slate-200 p-5 ${card.tone}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide">{card.label}</p>
              <card.icon size={18} aria-hidden />
            </div>
            {notifications.isLoading ? <Skeleton className="mt-3 h-8 w-16" /> : <p className="mt-2 text-3xl font-bold">{card.value}</p>}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Recommended attention" description="Links use the same server-side filtered report data.">
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <span>High-priority new cases</span>
              <Link to="/official/reports?overdueOnly=true" className="font-semibold text-brand-700 underline">Review</Link>
            </li>
            <li className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <span>Overdue / SLA planning view</span>
              <Link to="/official/reports" className="font-semibold text-brand-700 underline">Open table</Link>
            </li>
            <li className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <span>Reported damage hotspots</span>
              <Link to="/official/hotspots" className="font-semibold text-brand-700 underline">Open map</Link>
            </li>
          </ul>
        </Card>

        <Card title="Internal domain events" description={canViewEvents ? 'Recent in-process events for administrators.' : 'Event feed is restricted to administrators.'}>
          {!canViewEvents ? (
            <p className="text-sm text-slate-500">Your role can view notification counts but not the administrative event feed.</p>
          ) : events.isLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-12 w-full" />)}</div>
          ) : events.data?.events.length ? (
            <ul className="max-h-96 space-y-3 overflow-y-auto">
              {events.data.events.map((event) => (
                <li key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{event.type.replace(/_/g, ' ')}</p>
                    <Badge tone="neutral">{formatDateTime(event.createdAt)}</Badge>
                  </div>
                  <p className="mt-1 break-words text-xs text-slate-500">{JSON.stringify(event.payload)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No internal events have been emitted in this process yet.</p>
          )}
        </Card>
      </div>
    </OfficialLayout>
  );
}
