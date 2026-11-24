import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';

import {
  ClassDistributionChart,
  DistributionPie,
  TrendChart,
  severityColor,
} from '../components/charts/Charts';
import { PageHeader } from '../components/layout/AppShell';
import { Card, StatCard } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Select } from '../components/ui/Input';
import { SkeletonChart } from '../components/ui/Skeleton';
import { analyticsService } from '../services/analytics.service';
import { classLabel, formatNumber, formatPercent } from '../utils/format';

const DATE_RANGES = [
  { value: '', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

function rangeToDate(range: string): string | undefined {
  if (!range) return undefined;
  const date = new Date();
  date.setDate(date.getDate() - Number(range));
  return date.toISOString();
}

export function AnalyticsPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState('');
  const [damageType, setDamageType] = useState('');
  const [severity, setSeverity] = useState('');
  const [interval, setInterval] = useState<'day' | 'week' | 'month'>('day');

  const params = {
    from: rangeToDate(range),
    damageType: damageType || undefined,
    severity: severity || undefined,
  };

  const summary = useQuery({
    queryKey: ['analytics', 'summary', params],
    queryFn: () => analyticsService.summary(params),
  });
  const timeseries = useQuery({
    queryKey: ['analytics', 'timeseries', interval, params],
    queryFn: () => analyticsService.timeseries({ ...params, interval }),
  });
  const distribution = useQuery({
    queryKey: ['analytics', 'distribution', params],
    queryFn: () => analyticsService.distribution(params),
  });

  const hasData = (summary.data?.totalInspections ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Insight into damage patterns across your stored inspections."
      />

      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            label="Date range"
            name="range"
            value={range}
            onChange={(event) => setRange(event.target.value)}
            options={DATE_RANGES}
          />
          <Select
            label="Damage type"
            name="damageType"
            value={damageType}
            onChange={(event) => setDamageType(event.target.value)}
            options={[
              { value: '', label: 'All types' },
              { value: 'pothole', label: 'Pothole' },
              { value: 'longitudinal_crack', label: 'Longitudinal Crack' },
              { value: 'transverse_crack', label: 'Transverse Crack' },
              { value: 'alligator_crack', label: 'Alligator Crack' },
            ]}
          />
          <Select
            label="Severity"
            name="severity"
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
            options={[
              { value: '', label: 'All severities' },
              { value: 'high', label: 'High' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'low', label: 'Low' },
            ]}
          />
        </div>
      </Card>

      {summary.error ? (
        <ErrorState message="Could not load analytics." onRetry={() => summary.refetch()} />
      ) : !hasData && !summary.isLoading ? (
        <EmptyState
          icon={<BarChart3 size={22} />}
          title="No analytics data for this period"
          description="Adjust the filters, or run more analyses to build up analytics."
          action={{ label: 'Analyse an image', onClick: () => navigate('/app/analyze') }}
          secondaryAction={{ label: 'Clear filters', onClick: () => {
            setRange('');
            setDamageType('');
            setSeverity('');
          } }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard
              label="Inspections"
              value={formatNumber(summary.data?.totalInspections ?? 0)}
              loading={summary.isLoading}
            />
            <StatCard
              label="Total detections"
              value={formatNumber(summary.data?.totalDetections ?? 0)}
              loading={summary.isLoading}
            />
            <StatCard
              label="Avg confidence"
              value={
                summary.data?.avgConfidence != null
                  ? formatPercent(summary.data.avgConfidence, 1)
                  : '—'
              }
              loading={summary.isLoading}
            />
            <StatCard
              label="High severity"
              value={formatNumber(summary.data?.highSeverityInspections ?? 0)}
              accent="danger"
              loading={summary.isLoading}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card
              title="Inspections over time"
              className="lg:col-span-2"
              actions={
                <div className="flex rounded-md bg-slate-100 p-0.5" role="group" aria-label="Interval">
                  {(['day', 'week', 'month'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={interval === value}
                      onClick={() => setInterval(value)}
                      className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                        interval === value
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              }
            >
              {timeseries.isLoading ? (
                <SkeletonChart />
              ) : (
                <TrendChart data={timeseries.data?.points ?? []} height={300} />
              )}
            </Card>

            <Card title="Severity distribution">
              {distribution.isLoading ? (
                <SkeletonChart />
              ) : (
                <DistributionPie
                  data={(distribution.data?.bySeverity ?? []).map((entry) => ({
                    name: entry.name,
                    count: entry.count,
                  }))}
                  colorFor={severityColor}
                  height={300}
                />
              )}
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title="Damage type distribution">
              {distribution.isLoading ? (
                <SkeletonChart />
              ) : (
                <ClassDistributionChart data={distribution.data?.byClass ?? []} />
              )}
            </Card>

            <Card title="Top affected areas" description="Grouped by recorded address">
              {summary.isLoading ? (
                <SkeletonChart />
              ) : (summary.data?.topAreas.length ?? 0) === 0 ? (
                <EmptyState
                  compact
                  title="No area data yet"
                  description="Add addresses to inspections to see geographic breakdowns."
                />
              ) : (
                <ul className="space-y-3">
                  {summary.data!.topAreas.map((area, index) => {
                    const max = summary.data!.topAreas[0].count;
                    return (
                      <li key={area.area}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-800">
                            {index + 1}. {area.area}
                          </span>
                          <span className="tabular text-xs text-slate-500">
                            {area.count} inspection{area.count === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-brand-500"
                            style={{ width: `${(area.count / max) * 100}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          {(distribution.data?.byClass.length ?? 0) > 0 ? (
            <p className="mt-4 text-xs text-slate-400">
              Most common:{' '}
              {classLabel(distribution.data!.byClass[0].name)} (
              {distribution.data!.byClass[0].count} detections). All statistics are computed from
              stored inspections.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
