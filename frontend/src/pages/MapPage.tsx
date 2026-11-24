import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { MapPinOff } from 'lucide-react';

import { PageHeader } from '../components/layout/AppShell';
import { Badge, SeverityBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Select } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { analyticsService } from '../services/analytics.service';
import { MapReport, Severity } from '../types';
import { classLabel, formatDateTime } from '../utils/format';
import { severityMeta } from '../utils/severity';

/** Custom colored pin (avoids Leaflet's broken default marker assets in bundlers). */
function pinIcon(severity: Severity | null) {
  const color = severityMeta(severity)?.color ?? '#3372f0';
  return L.divIcon({
    className: '',
    iconSize: [26, 34],
    iconAnchor: [13, 33],
    popupAnchor: [0, -30],
    html: `
      <svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 0C5.8 0 0 5.8 0 13c0 9.8 13 21 13 21s13-11.2 13-21C26 5.8 20.2 0 13 0z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
        <circle cx="13" cy="13" r="5.5" fill="#ffffff"/>
      </svg>`,
  });
}

export function MapPage() {
  const navigate = useNavigate();
  const [severity, setSeverity] = useState('');
  const [damageType, setDamageType] = useState('');

  const reports = useQuery({
    queryKey: ['map-reports', severity, damageType],
    queryFn: () =>
      analyticsService.mapReports({
        severity: severity || undefined,
        damageType: damageType || undefined,
      }),
  });

  const items = useMemo(() => reports.data?.reports ?? [], [reports.data]);

  const center = useMemo<[number, number]>(() => {
    if (items.length === 0) return [26.1445, 91.7362]; // Guwahati default
    const avgLat = items.reduce((sum, r) => sum + r.latitude, 0) / items.length;
    const avgLng = items.reduce((sum, r) => sum + r.longitude, 0) / items.length;
    return [avgLat, avgLng];
  }, [items]);

  return (
    <div>
      <PageHeader
        title="Road damage map"
        description="Geographic view of inspections that include location data."
      />

      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-3">
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
              { value: 'other', label: 'Other' },
            ]}
          />
          <div className="flex items-end">
            <p className="tabular pb-2 text-xs text-slate-500">
              {reports.isLoading
                ? 'Loading reports…'
                : `${items.length} located report${items.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
      </Card>

      {reports.isLoading ? (
        <div className="flex h-[540px] items-center justify-center rounded-lg border border-slate-200 bg-white">
          <Spinner size="lg" label="Loading map" />
        </div>
      ) : reports.error ? (
        <ErrorState
          message="Could not load map reports."
          onRetry={() => reports.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<MapPinOff size={22} />}
          title="No map reports available"
          description="Inspections with location data will appear here. Add a location when analysing an image to populate the map."
          action={{ label: 'Analyse an image', onClick: () => navigate('/app/analyze') }}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 shadow-card">
          <div className="h-[540px] w-full">
            <MapContainer
              center={center}
              zoom={12}
              scrollWheelZoom
              className="h-full w-full"
              aria-label="Road damage map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {items.map((report: MapReport) => (
                <Marker
                  key={report.inspectionId}
                  position={[report.latitude, report.longitude]}
                  icon={pinIcon(report.maxSeverity)}
                >
                  <Popup>
                    <div className="min-w-[220px] text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">
                          {report.detectionCount} detection
                          {report.detectionCount === 1 ? '' : 's'}
                        </p>
                        <SeverityBadge severity={report.maxSeverity} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(report.timestamp)}</p>
                      <p className="mt-1.5 text-xs text-slate-700">
                        {report.address ?? 'No address recorded'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {report.damageTypes.map((type) => (
                          <Badge key={type} tone="neutral">
                            {classLabel(type)}
                          </Badge>
                        ))}
                      </div>
                      <p className="tabular mt-2 text-xs text-slate-500">
                        Peak confidence {(report.maxConfidence * 100).toFixed(0)}%
                      </p>
                      <Button
                        size="sm"
                        className="mt-2.5 w-full"
                        onClick={() => navigate(`/app/inspections/${report.inspectionId}`)}
                      >
                        Open report
                      </Button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 bg-white px-4 py-2.5 text-xs text-slate-500">
            <span className="font-medium text-slate-600">Severity legend:</span>
            {(['high', 'moderate', 'low'] as Severity[]).map((level) => (
              <span key={level} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: severityMeta(level)?.color }}
                />
                {severityMeta(level)?.label}
              </span>
            ))}
            <span className="ml-auto">
              Marker positions are approximate inspection locations — no personal data is shown.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
