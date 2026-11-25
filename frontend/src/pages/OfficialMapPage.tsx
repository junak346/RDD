import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { Flame, MapPin } from 'lucide-react';

import { PriorityBadge, StatusBadge } from '../components/official/OfficialBadges';
import { OfficialLayout, OfficialPageHeader } from '../components/layout/OfficialLayout';
import { Alert } from '../components/ui/Alert';
import { Badge, SeverityBadge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Select } from '../components/ui/Input';
import { SkeletonCard } from '../components/ui/Skeleton';
import { officialService } from '../services/official.service';
import { CivicPriority, CivicStatus, GovernmentMapReport, Severity } from '../types';
import { classLabel, formatDateTime, formatPercent } from '../utils/format';

const DEFAULT_CENTER: [number, number] = [26.1445, 91.7362]; // viewport only, never a statistic

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'SUBMITTED', label: 'New / submitted' },
  { value: 'AI_ANALYSIS', label: 'AI analysis' },
  { value: 'AI_ANALYSED', label: 'AI analysed' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'REJECTED', label: 'Rejected' },
];

function markerColor(report: GovernmentMapReport): string {
  if (report.status === 'RESOLVED' || report.status === 'CLOSED') return '#16a34a';
  if (report.priority === 'CRITICAL' || report.priority === 'HIGH') return '#dc2626';
  if (report.status === 'ASSIGNED' || report.status === 'IN_PROGRESS') return '#2563eb';
  if (report.status === 'UNDER_REVIEW' || report.status === 'VERIFIED') return '#d97706';
  return '#7c3aed';
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, center === DEFAULT_CENTER ? 11 : 12);
  }, [center, map]);
  return null;
}

function CommandMap({ hotspotsOnly }: { hotspotsOnly: boolean }) {
  const reportsQuery = useQuery({ queryKey: ['official-map'], queryFn: officialService.map, enabled: !hotspotsOnly });
  const analyticsQuery = useQuery({ queryKey: ['official-analytics'], queryFn: officialService.analytics, enabled: hotspotsOnly });
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [severity, setSeverity] = useState('');

  const reports = useMemo(
    () =>
      (reportsQuery.data?.reports ?? []).filter((report) =>
        (!status || report.status === status) &&
        (!priority || report.priority === priority) &&
        (!severity || report.severity === severity),
      ),
    [reportsQuery.data, status, priority, severity],
  );
  const hotspots = useMemo(
    () => analyticsQuery.data?.hotspots ?? [],
    [analyticsQuery.data],
  );
  const center = useMemo<[number, number]>(() => {
    const source = hotspotsOnly ? hotspots : reports;
    if (!source.length) return DEFAULT_CENTER;
    const latitude = source.reduce((sum, item) => sum + item.latitude, 0) / source.length;
    const longitude = source.reduce((sum, item) => sum + item.longitude, 0) / source.length;
    return [latitude, longitude];
  }, [hotspotsOnly, hotspots, reports]);

  return (
    <OfficialLayout>
      <OfficialPageHeader
        title={hotspotsOnly ? 'Reported Damage Hotspots' : 'Government command map'}
        description={
          hotspotsOnly
            ? 'Descriptive geographic aggregation of repeated reports and higher estimated severity. This is not a claim of statistical significance.'
            : 'Real geolocated citizen reports. Marker colors reflect case state; filters are applied to current stored data.'
        }
        actions={<Badge tone="info">{hotspotsOnly ? `${hotspots.length} grid areas` : `${reports.length} visible reports`}</Badge>}
      />

      {hotspotsOnly ? (
        <Alert tone="info" className="mb-5" title="Reported Damage Hotspots">
          Grid aggregation uses real report coordinates. Repeated reports do not prove causation or
          engineering significance; officials should inspect the underlying cases.
        </Alert>
      ) : null}

      <Card className="mb-5" title="Map filters" description="Filter by official status, administrative priority or AI severity.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Status" name="status" value={status} onChange={(event) => setStatus(event.target.value)} options={STATUS_OPTIONS} />
          <Select label="Priority" name="priority" value={priority} onChange={(event) => setPriority(event.target.value)} options={[{ value: '', label: 'All priorities' }, ...(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as CivicPriority[]).map((value) => ({ value, label: value }))]} />
          <Select label="AI severity" name="severity" value={severity} onChange={(event) => setSeverity(event.target.value)} options={[{ value: '', label: 'All severities' }, ...(['low', 'moderate', 'high'] as Severity[]).map((value) => ({ value, label: value }))]} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
          {[
            ['#7c3aed', 'New'],
            ['#d97706', 'Under review / verified'],
            ['#dc2626', 'High priority'],
            ['#2563eb', 'Assigned / in progress'],
            ['#16a34a', 'Resolved'],
          ].map(([color, label]) => (
            <span key={label} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} /> {label}</span>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-4">
        <Card className="xl:col-span-3" padded={false}>
          <div className="h-[68vh] min-h-[480px] overflow-hidden rounded-lg">
            <MapContainer center={center} zoom={12} scrollWheelZoom>
              <Recenter center={center} />
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {!hotspotsOnly
                ? reports.map((report) => (
                    <CircleMarker
                      key={report.id}
                      center={[report.latitude, report.longitude]}
                      radius={report.priority === 'CRITICAL' ? 12 : 9}
                      pathOptions={{ color: '#ffffff', weight: 2, fillColor: markerColor(report), fillOpacity: 0.88 }}
                    >
                      <Popup>
                        <div className="min-w-[220px] space-y-1 text-sm">
                          <p className="font-bold text-slate-900">{report.publicReportId}</p>
                          <p>{report.damageType ? classLabel(report.damageType) : 'AI pending / no damage'}</p>
                          <p>Severity: {report.severity ?? '—'} · Confidence: {report.confidence !== null ? formatPercent(report.confidence) : '—'}</p>
                          <p>Status: {report.status.replace(/_/g, ' ')} · Priority: {report.priority}</p>
                          <p className="text-xs text-slate-500">{formatDateTime(report.submittedAt)}</p>
                          <p className="tabular text-xs text-slate-500">{report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}</p>
                          {report.incidentPublicId ? <p className="text-xs">Incident {report.incidentPublicId}</p> : null}
                          <Link to={`/official/reports/${report.id}`} className="font-semibold text-brand-700 underline">Open case</Link>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))
                : hotspots.map((hotspot) => (
                    <CircleMarker
                      key={hotspot.key}
                      center={[hotspot.latitude, hotspot.longitude]}
                      radius={Math.min(34, 10 + hotspot.count * 4)}
                      pathOptions={{ color: hotspot.maxSeverity === 'high' ? '#dc2626' : '#f97316', fillColor: '#f97316', fillOpacity: 0.3, weight: 2 }}
                    >
                      <Popup>
                        <div className="space-y-1 text-sm">
                          <p className="font-bold">Reported hotspot</p>
                          <p>{hotspot.count} citizen reports in this grid area</p>
                          <p>Max estimated severity: {hotspot.maxSeverity ?? '—'}</p>
                          <p>Damage types: {hotspot.damageTypes.map(classLabel).join(', ') || '—'}</p>
                          <p className="tabular text-xs">{hotspot.latitude.toFixed(3)}, {hotspot.longitude.toFixed(3)}</p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
            </MapContainer>
          </div>
        </Card>

        <Card title={hotspotsOnly ? 'Hotspot areas' : 'Visible reports'} description="Computed from stored reports, not seeded values." padded={false}>
          {(hotspotsOnly ? analyticsQuery.isLoading : reportsQuery.isLoading) ? (
            <div className="p-4"><SkeletonCard lines={4} /></div>
          ) : hotspotsOnly ? (
            hotspots.length ? (
              <ul className="max-h-[62vh] divide-y divide-slate-100 overflow-y-auto">
                {hotspots.map((hotspot) => (
                  <li key={hotspot.key} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{hotspot.count} reports</span>
                      <SeverityBadge severity={hotspot.maxSeverity} />
                    </div>
                    <p className="mt-1 tabular text-xs text-slate-500">{hotspot.latitude.toFixed(3)}, {hotspot.longitude.toFixed(3)}</p>
                    <p className="mt-1 text-xs text-slate-500">{hotspot.damageTypes.map(classLabel).join(', ') || 'No damage type'}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="p-5 text-sm text-slate-500">No geographic groups have been reported yet.</p>
          ) : reports.length ? (
            <ul className="max-h-[62vh] divide-y divide-slate-100 overflow-y-auto">
              {reports.map((report) => (
                <li key={report.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/official/reports/${report.id}`} className="text-sm font-semibold text-brand-700 hover:underline">{report.publicReportId}</Link>
                    <StatusBadge status={report.status as CivicStatus} />
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{report.damageType ? classLabel(report.damageType) : 'AI pending / none'}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={report.priority as CivicPriority} />
                    <SeverityBadge severity={report.severity} />
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} /> {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}</p>
                </li>
              ))}
            </ul>
          ) : <p className="p-5 text-sm text-slate-500">No reports match the current filters.</p>}
        </Card>
      </div>

      {hotspotsOnly ? (
        <p className="mt-5 flex gap-2 rounded-xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
          <Flame size={16} className="mt-0.5 shrink-0" aria-hidden />
          “Reported Damage Hotspots” is a descriptive operational view. It does not claim statistical
          significance, causation or a civil-engineering assessment.
        </p>
      ) : null}
    </OfficialLayout>
  );
}

export function OfficialMapPage() {
  return <CommandMap hotspotsOnly={false} />;
}

export function OfficialHotspotsPage() {
  return <CommandMap hotspotsOnly />;
}
