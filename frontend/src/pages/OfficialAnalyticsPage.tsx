import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Flame } from 'lucide-react';

import { OfficialLayout, OfficialPageHeader } from '../components/layout/OfficialLayout';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { Select } from '../components/ui/Input';
import { SkeletonChart } from '../components/ui/Skeleton';
import { officialService } from '../services/official.service';
import { classLabel, formatPercent } from '../utils/format';

const CHART_COLORS = ['#4f46e5', '#0891b2', '#f59e0b', '#dc2626', '#16a34a', '#7c3aed'];

export function OfficialAnalyticsPage() {
  const analytics = useQuery({ queryKey: ['official-analytics'], queryFn: officialService.analytics });
  const [interval, setInterval] = useState<'day' | 'week' | 'month'>('day');
  const data = analytics.data;

  const timeseries =
    interval === 'day' ? data?.reportsByDay : interval === 'week' ? data?.reportsByWeek : data?.reportsByMonth;
  const chartData = (timeseries ?? []).map((point) => ({ date: point.date, Reports: point.reports }));
  const damageData = (data?.damageTypes ?? []).map((item) => ({ name: classLabel(item.name), value: item.count }));
  const severityData = (data?.severityDistribution ?? []).map((item) => ({ name: item.name, value: item.count }));
  const departmentData = (data?.reportsByDepartment ?? []).map((item) => ({ name: item.name, Reports: item.count }));

  return (
    <OfficialLayout>
      <OfficialPageHeader
        title="Government analytics"
        description="Every number and chart is derived from the current report database — no seeded dashboard statistics."
        actions={
          <Link to="/official/hotspots"><Button variant="outline" icon={<Flame size={15} />}>Reported hotspots</Button></Link>
        }
      />

      {analytics.isError ? <Alert tone="danger">Analytics could not be loaded.</Alert> : null}
      {analytics.isLoading ? (
        <div className="grid gap-5 lg:grid-cols-2"><SkeletonChart /><SkeletonChart /><SkeletonChart /><SkeletonChart /></div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Citizen report volume" value={data.citizenReportVolume} accent="brand" />
            <StatCard label="Resolution rate" value={formatPercent(data.resolutionRate, 1)} accent="success" />
            <StatCard label="Avg. resolution time" value={data.averageResolutionHours !== null ? `${data.averageResolutionHours.toFixed(1)} h` : '—'} accent="brand" />
            <StatCard label="Unresolved reports" value={data.unresolvedReports} accent="warning" />
            <StatCard label="Overdue reports" value={data.overdueReports} accent="danger" />
            <StatCard label="Repeat damage locations" value={data.repeatDamageLocations} accent="danger" />
            <StatCard label="Damage categories" value={data.damageTypes.length} accent="brand" />
            <StatCard label="Department assignments" value={data.reportsByDepartment.reduce((sum, item) => sum + item.count, 0)} accent="slate" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card
              title="Reports over time"
              description="Grouped from stored submission timestamps."
              actions={
                <Select label="" name="interval" value={interval} onChange={(event) => setInterval(event.target.value as 'day' | 'week' | 'month')} options={[{ value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} className="w-32" />
              }
            >
              <div className="h-72">
                {chartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="Reports" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="flex h-full items-center justify-center text-sm text-slate-500">No reports in the selected period.</p>}
              </div>
            </Card>

            <Card title="Damage types" description="AI class counts from stored detections.">
              <div className="h-72">
                {damageData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={damageData} dataKey="value" nameKey="name" outerRadius={95} label>
                        {damageData.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="flex h-full items-center justify-center text-sm text-slate-500">No damage classes have been recorded.</p>}
              </div>
            </Card>

            <Card title="Estimated severity distribution" description="Computer-vision triage estimates, not official severity.">
              <div className="h-72">
                {severityData.some((item) => item.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={severityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" name="Reports" radius={[4, 4, 0, 0]}>
                        {severityData.map((entry) => (
                          <Cell key={entry.name} fill={entry.name === 'high' ? '#dc2626' : entry.name === 'moderate' ? '#f59e0b' : '#16a34a'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="flex h-full items-center justify-center text-sm text-slate-500">No severity estimates have been recorded.</p>}
              </div>
            </Card>

            <Card title="Reports by department" description="Administrative assignment counts from real cases.">
              <div className="h-72">
                {departmentData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentData} layout="vertical" margin={{ left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="Reports" fill="#0891b2" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="flex h-full items-center justify-center text-sm text-slate-500">No department assignments yet.</p>}
              </div>
            </Card>
          </div>

          <Card className="mt-6" title="Reported Damage Hotspots" description="Geographic aggregation of repeat report areas — descriptive only.">
            {data.hotspots.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr><th className="px-4 py-2">Area</th><th className="px-4 py-2">Reports</th><th className="px-4 py-2">Max estimated severity</th><th className="px-4 py-2">Damage types</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.hotspots.slice(0, 10).map((hotspot) => (
                      <tr key={hotspot.key}>
                        <td className="px-4 py-2 tabular">{hotspot.latitude.toFixed(3)}, {hotspot.longitude.toFixed(3)}</td>
                        <td className="px-4 py-2 font-semibold">{hotspot.count}</td>
                        <td className="px-4 py-2">{hotspot.maxSeverity ?? '—'}</td>
                        <td className="px-4 py-2">{hotspot.damageTypes.map(classLabel).join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-slate-500">No geographic groups have been recorded.</p>}
            <p className="mt-4 text-xs text-slate-500">Generated {new Date(data.generatedAt).toLocaleString()} from {data.totalReports} stored reports.</p>
          </Card>
        </>
      ) : null}
    </OfficialLayout>
  );
}
