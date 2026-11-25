import { useQuery } from '@tanstack/react-query';
import { Layers3 } from 'lucide-react';

import { OfficialLayout, OfficialPageHeader } from '../components/layout/OfficialLayout';
import { Alert } from '../components/ui/Alert';
import { Badge, SeverityBadge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { SkeletonTable } from '../components/ui/Skeleton';
import { officialService } from '../services/official.service';
import { classLabel, formatDateTime } from '../utils/format';

export function OfficialIncidentsPage() {
  const incidents = useQuery({ queryKey: ['official-incidents'], queryFn: officialService.incidents });
  const list = incidents.data?.incidents ?? [];

  return (
    <OfficialLayout>
      <OfficialPageHeader
        title="Grouped incidents"
        description="Likely duplicate reports are grouped by GPS proximity, time and damage type. Individual citizen reports are preserved."
        actions={<Badge tone="info">{list.length} incident(s)</Badge>}
      />
      <Alert tone="info" className="mb-6" title="Citizen report count is not statistical significance">
        Grouping is an operational triage aid. Officials should verify each underlying report before
        drawing conclusions about road condition or priority.
      </Alert>

      {incidents.isError ? <Alert tone="danger">Incidents could not be loaded.</Alert> : null}
      {incidents.isLoading ? <SkeletonTable rows={6} cols={6} /> : (
        <Card title="Incident groups" padded={false}>
          {list.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Incident</th>
                    <th className="px-5 py-3">Citizen reports</th>
                    <th className="px-5 py-3">Likely damage</th>
                    <th className="px-5 py-3">Max estimated severity</th>
                    <th className="px-5 py-3">Approx. centre</th>
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((incident) => (
                    <tr key={incident.id}>
                      <td className="px-5 py-3 font-semibold text-slate-900">{incident.publicIncidentId}</td>
                      <td className="px-5 py-3"><Badge tone="brand">{incident.reportCount} citizen reports</Badge></td>
                      <td className="px-5 py-3">{incident.primaryDamageType ? classLabel(incident.primaryDamageType) : '—'}</td>
                      <td className="px-5 py-3"><SeverityBadge severity={incident.maxSeverity} /></td>
                      <td className="px-5 py-3 tabular text-xs">{incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{formatDateTime(incident.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <Layers3 size={28} className="text-slate-400" />
              <p className="text-sm font-medium text-slate-700">No grouped incidents yet</p>
              <p className="text-xs text-slate-500">Nearby reports with the same likely damage type will appear here.</p>
            </div>
          )}
        </Card>
      )}
    </OfficialLayout>
  );
}
