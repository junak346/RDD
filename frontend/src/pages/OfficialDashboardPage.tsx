import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock3,
  FileStack,
  Flame,
  ShieldCheck,
} from 'lucide-react';

import { PriorityBadge, StatusBadge } from '../components/official/OfficialBadges';
import { OfficialLayout, OfficialPageHeader } from '../components/layout/OfficialLayout';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { officialService } from '../services/official.service';
import { classLabel, formatDateTime } from '../utils/format';

export function OfficialDashboardPage() {
  const dashboard = useQuery({ queryKey: ['official-dashboard'], queryFn: officialService.dashboard });
  const notifications = useQuery({ queryKey: ['official-notifications'], queryFn: officialService.notifications });
  const recent = useQuery({
    queryKey: ['official-recent-reports'],
    queryFn: () => officialService.reports({ limit: 6, sort: 'createdAt_desc' }),
  });
  const analytics = useQuery({ queryKey: ['official-analytics'], queryFn: officialService.analytics });

  const data = dashboard.data;
  const stats = [
    { label: 'Total reports', value: data?.totalReports ?? 0, icon: FileStack, accent: 'brand' as const },
    { label: 'New reports', value: data?.newReports ?? 0, icon: CircleDot, accent: 'brand' as const },
    { label: 'Under review', value: data?.underReview ?? 0, icon: ClipboardCheck, accent: 'warning' as const },
    { label: 'Verified', value: data?.verified ?? 0, icon: ShieldCheck, accent: 'success' as const },
    { label: 'High priority', value: data?.highPriority ?? 0, icon: Flame, accent: 'danger' as const },
    { label: 'In progress', value: data?.inProgress ?? 0, icon: Clock3, accent: 'brand' as const },
    { label: 'Resolved', value: data?.resolved ?? 0, icon: CheckCircle2, accent: 'success' as const },
    { label: 'Overdue', value: data?.overdue ?? 0, icon: AlertTriangle, accent: 'danger' as const },
  ];

  return (
    <OfficialLayout>
      <OfficialPageHeader
        title="Command dashboard"
        description="All figures are computed from stored citizen reports and official case decisions."
        actions={
          <>
            <Link to="/official/map"><Button variant="outline" icon={<Flame size={15} />}>Open map</Button></Link>
            <Link to="/official/reports"><Button>Review reports</Button></Link>
          </>
        }
      />

      {dashboard.isError ? <Alert tone="danger">Could not load dashboard data.</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={<stat.icon size={19} />}
            accent={stat.accent}
            loading={dashboard.isLoading}
          />
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Latest citizen reports" description="Fresh evidence from the public reporting flow." padded={false}>
          {recent.isLoading ? (
            <div className="space-y-3 p-5">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-12 w-full" />)}</div>
          ) : recent.data?.items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Report</th>
                    <th className="px-5 py-3">AI evidence</th>
                    <th className="px-5 py-3">Priority</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Submitted</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recent.data.items.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-semibold text-slate-900">{report.publicReportId}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {report.ai.damageType ? classLabel(report.ai.damageType) : 'Pending / none'}
                        {report.ai.demo ? <Badge tone="warning" className="ml-2">Demo</Badge> : null}
                      </td>
                      <td className="px-5 py-3"><PriorityBadge priority={report.priority} /></td>
                      <td className="px-5 py-3"><StatusBadge status={report.status} /></td>
                      <td className="px-5 py-3 text-xs text-slate-500">{formatDateTime(report.submittedAt)}</td>
                      <td className="px-5 py-3 text-right">
                        <Link to={`/official/reports/${report.id}`} className="text-sm font-semibold text-brand-700 hover:underline">Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-6 text-sm text-slate-500">No citizen reports have been submitted yet.</p>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Notification center" description="Real backend counts — no delivery is claimed.">
            <ul className="space-y-3 text-sm">
              <li className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2.5 text-red-800">
                New high-priority reports <strong>{notifications.data?.newHighPriorityReports ?? 0}</strong>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2.5 text-amber-800">
                Overdue reports <strong>{notifications.data?.overdueReports ?? 0}</strong>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-sky-50 px-3 py-2.5 text-sky-800">
                Assigned to you <strong>{notifications.data?.assignedToMe ?? 0}</strong>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-slate-700">
                New reports <strong>{notifications.data?.newReports ?? 0}</strong>
              </li>
            </ul>
            <Link to="/official/notifications" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
              Open internal notifications
            </Link>
          </Card>

          <Card title="Operational signals">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Resolution rate</dt>
                <dd className="font-semibold text-slate-900">
                  {analytics.data ? `${Math.round(analytics.data.resolutionRate * 100)}%` : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Avg. resolution</dt>
                <dd className="font-semibold text-slate-900">
                  {analytics.data?.averageResolutionHours !== null && analytics.data
                    ? `${analytics.data.averageResolutionHours.toFixed(1)} h`
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Grouped incidents</dt>
                <dd className="font-semibold text-slate-900">{data?.incidents ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">No damage detected</dt>
                <dd className="font-semibold text-slate-900">{data?.noDamageDetected ?? 0}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </OfficialLayout>
  );
}
