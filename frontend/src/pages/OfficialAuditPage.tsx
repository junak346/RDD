import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, ShieldCheck } from 'lucide-react';

import { OfficialLayout, OfficialPageHeader } from '../components/layout/OfficialLayout';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { SkeletonTable } from '../components/ui/Skeleton';
import { officialService } from '../services/official.service';
import { formatDateTime } from '../utils/format';

export function OfficialAuditPage() {
  const [reportId, setReportId] = useState('');
  const audit = useQuery({
    queryKey: ['official-audit', reportId],
    queryFn: () => officialService.auditLogs(reportId || undefined, 200),
  });

  return (
    <OfficialLayout>
      <OfficialPageHeader
        title="Audit history"
        description="Append-only system and case events with actor, role, action, timestamp and report reference."
      />

      <Alert tone="info" className="mb-6" title="Immutable-style records">
        Repositories expose no audit update or delete operation. Ordinary officials cannot silently
        change case history, and permanent deletion is not available through this portal.
      </Alert>

      <Card className="mb-5" title="Filter" description="Optionally narrow the feed by internal report ID.">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Input label="Internal report ID" name="reportId" value={reportId} onChange={(event) => setReportId(event.target.value)} placeholder="report_…" />
          <p className="pb-2 text-xs text-slate-500">{audit.data?.logs.length ?? 0} event(s)</p>
        </div>
      </Card>

      {audit.isError ? <Alert tone="danger">Audit history could not be loaded.</Alert> : null}
      {audit.isLoading ? <SkeletonTable rows={8} cols={6} /> : (
        <Card title="Events" padded={false}>
          {audit.data?.logs.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Report</th>
                    <th className="px-4 py-3">Metadata</th>
                    <th className="px-4 py-3">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {audit.data.logs.map((log) => (
                    <tr key={log.id} className="align-top hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDateTime(log.timestamp)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{log.action.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">{log.actor}</td>
                      <td className="px-4 py-3 text-xs">{log.role.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-xs">{log.reportPublicId ?? log.reportId ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {log.metadata ? <code className="break-all">{JSON.stringify(log.metadata)}</code> : '—'}
                      </td>
                      <td className="px-4 py-3"><Badge tone="success">Append-only</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <ScrollText size={28} className="text-slate-400" />
              <p className="text-sm font-medium text-slate-700">No audit events found</p>
              <p className="text-xs text-slate-500">Events will appear as reports are submitted and cases are acted on.</p>
            </div>
          )}
        </Card>
      )}
      <p className="mt-4 flex gap-2 text-xs text-slate-500"><ShieldCheck size={14} /> Passwords, session tokens, and unnecessary citizen personal data are never written to audit logs.</p>
    </OfficialLayout>
  );
}
