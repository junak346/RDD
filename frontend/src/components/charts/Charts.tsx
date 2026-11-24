import {
  Area,
  AreaChart,
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

import { classColor, severityMeta } from '../../utils/severity';
import { classLabel } from '../../utils/format';

const AXIS_STYLE = { fontSize: 11, fill: '#64748b' };

interface TrendPoint {
  date: string;
  inspections: number;
  detections: number;
}

export function TrendChart({ data, height = 260 }: { data: TrendPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="fillInspections" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3372f0" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#3372f0" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fillDetections" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="date" tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
        <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            fontSize: 12,
            boxShadow: '0 10px 30px -12px rgb(15 23 42 / 0.18)',
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="inspections"
          name="Inspections"
          stroke="#3372f0"
          strokeWidth={2}
          fill="url(#fillInspections)"
        />
        <Area
          type="monotone"
          dataKey="detections"
          name="Detections"
          stroke="#8b5cf6"
          strokeWidth={2}
          fill="url(#fillDetections)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface Slice {
  name: string;
  count: number;
}

export function DistributionPie({
  data,
  colorFor,
  height = 260,
}: {
  data: Slice[];
  colorFor: (name: string) => string;
  height?: number;
}) {
  const total = data.reduce((sum, slice) => sum + slice.count, 0);
  if (total === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        No data for this period.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((slice) => (
            <Cell key={slice.name} fill={colorFor(slice.name)} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            fontSize: 12,
            boxShadow: '0 10px 30px -12px rgb(15 23 42 / 0.18)',
          }}
          formatter={(value: number, name: string) => [`${value} (${((value / total) * 100).toFixed(0)}%)`, name]}
        />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value: string) => classLabel(value)}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ClassDistributionChart({ data }: { data: Slice[] }) {
  const rows = data.map((slice) => ({ ...slice, label: classLabel(slice.name) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} width={110} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            fontSize: 12,
            boxShadow: '0 10px 30px -12px rgb(15 23 42 / 0.18)',
          }}
        />
        <Bar dataKey="count" name="Detections" radius={[0, 4, 4, 0]} barSize={18}>
          {rows.map((row) => (
            <Cell key={row.name} fill={classColor(row.name)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function severityColor(name: string): string {
  return severityMeta(name)?.color ?? '#64748b';
}
