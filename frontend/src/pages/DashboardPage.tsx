import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Camera,
  ChevronRight,
  MapPin,
  ScanLine,
} from 'lucide-react';

import {
  ClassDistributionChart,
  DistributionPie,
  TrendChart,
  severityColor,
} from '../components/charts/Charts';
import { PageHeader } from '../components/layout/AppShell';
import { Badge, SeverityBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton, SkeletonChart } from '../components/ui/Skeleton';
import { analyticsService } from '../services/analytics.service';
import { inspectionsService } from '../services/inspections.service';
import { classLabel, formatNumber, formatPercent, formatRelative } from '../utils/format';

export function DashboardPage() {
  const navigate = useNavigate();

  const summary = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: () => analyticsService.summary(),
  });
  const timeseries = useQuery({
    queryKey: ['analytics', 'timeseries', 'day'],
    queryFn: () => analyticsService.timeseries({ interval: 'day' }),
  });
  const distribution = useQuery({
    queryKey: ['analytics', 'distribution'],
    queryFn: () => analyticsService.distribution(),
  });
  const recent = useQuery({
    queryKey: ['inspections', 'recent'],
    queryFn: () => inspectionsService.recent(6),
  });

  const loading = summary.isLoading;
  const error = summary.error;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Road damage overview from your stored inspections."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Refresh
            </Button>
            <Button size="sm" icon={<ScanLine size={15} />} onClick={() => navigate('/app/analyze')}>
              New analysis
            </Button>
          </>
        }
      />

      {error ? (
        <ErrorState
          message="Could not load dashboard statistics from the server."
          onRetry={() => summary.refetch()}
        />
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard
              label="Total inspections"
              value={formatNumber(summary.data?.totalInspections ?? 0)}
              icon={<Camera size={18} />}
              accent="brand"
              loading={loading}
              sub={summary.data ? `Across ${summary.data.withLocation} located reports` : undefined}
            />
            <StatCard
              label="Damages detected"
              value={formatNumber(summary.data?.totalDetections ?? 0)}
              icon={<Activity size={18} />}
              accent="slate"
              loading={loading}
              sub={
                summary.data?.avgConfidence != null
                  ? `Avg confidence ${formatPercent(summary.data.avgConfidence)}`
                  : 'No detections yet'
              }
            />
            <StatCard
              label="Potholes"
              value={formatNumber(summary.data?.countsByClass?.pothole ?? 0)}
              icon={<AlertTriangle size={18} />}
              accent="danger"
              loading={loading}
            />
            <StatCard
              label="High severity"
              value={formatNumber(summary.data?.highSeverityInspections ?? 0)}
              icon={<AlertTriangle size={18} />}
              accent="warning"
              loading={loading}
              sub="Inspections with high-severity findings"
            />
          </div>

          {/* Charts */}
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card
              title="Damage trend"
              description="Inspections and detections over the last 30 days"
              className="lg:col-span-2"
            >
              {timeseries.isLoading ? (
                <SkeletonChart />
              ) : (timeseries.data?.points.length ?? 0) === 0 ? (
                <EmptyState
                  compact
                  title="No activity in this period"
                  description="Run your first analysis to start building trend data."
                  action={{ label: 'Analyse an image', onClick: () => navigate('/app/analyze') }}
                />
              ) : (
                <TrendChart data={timeseries.data!.points} />
              )}
            </Card>
            <Card title="Severity distribution" description="All detections by estimated severity">
              {distribution.isLoading ? (
                <SkeletonChart />
              ) : (
                <DistributionPie
                  data={(distribution.data?.bySeverity ?? []).map((entry) => ({
                    name: entry.name,
                    count: entry.count,
                  }))}
                  colorFor={severityColor}
                />
              )}
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card title="Damage type distribution">
              {distribution.isLoading ? (
                <SkeletonChart />
              ) : (distribution.data?.byClass.length ?? 0) === 0 ? (
                <EmptyState
                  compact
                  title="No detections yet"
                  description="Damage classes will appear here after your first analysis."
                />
              ) : (
                <ClassDistributionChart data={distribution.data!.byClass} />
              )}
            </Card>

            <Card
              title="Recent inspections"
              description="Latest analyses on your account"
              className="lg:col-span-2"
              padded={false}
              actions={
                <Link
                  to="/app/history"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  View all <ChevronRight size={13} />
                </Link>
              }
            >
              {recent.isLoading ? (
                <div className="space-y-3 p-5">
                  {[0, 1, 2].map((index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              ) : (recent.data?.length ?? 0) === 0 ? (
                <div className="p-5">
                  <EmptyState
                    compact
                    title="No inspections yet"
                    description="Upload a road image to run your first AI analysis."
                    action={{ label: 'Start analysis', onClick: () => navigate('/app/analyze') }}
                  />
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {recent.data!.map((inspection) => (
                    <li key={inspection.id}>
                      <Link
                        to={`/app/inspections/${inspection.id}`}
                        className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {inspection.summary.detectionCount} detection
                              {inspection.summary.detectionCount === 1 ? '' : 's'}
                              {Object.keys(inspection.summary.countsByClass)[0]
                                ? ` · ${classLabel(Object.keys(inspection.summary.countsByClass)[0])}`
                                : ''}
                            </p>
                            {inspection.model.demo ? <Badge tone="warning">Demo</Badge> : null}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {inspection.location?.address ?? 'No location'} ·{' '}
                            {formatRelative(inspection.createdAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <SeverityBadge severity={inspection.summary.maxSeverity} />
                          <ChevronRight size={15} className="text-slate-300" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Location stats */}
          <Card title="Location statistics" className="mt-6">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="tabular text-2xl font-semibold text-slate-900">
                  {formatNumber(summary.data?.withLocation ?? 0)}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin size={13} /> Inspections with location data
                </p>
              </div>
              <div className="h-10 w-px bg-slate-100" />
              <div className="flex-1">
                {summary.data?.topAreas?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {summary.data.topAreas.map((area) => (
                      <Badge key={area.area} tone="info">
                        {area.area} · {area.count}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Top affected areas appear once inspections include addresses.
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={<BarChart3 size={14} />}
                onClick={() => navigate('/app/map')}
              >
                Open map
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
