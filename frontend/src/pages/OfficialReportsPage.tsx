import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Filter } from 'lucide-react';

import { PriorityBadge, StatusBadge } from '../components/official/OfficialBadges';
import { OfficialLayout, OfficialPageHeader } from '../components/layout/OfficialLayout';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { SeverityBadge } from '../components/ui/Badge';
import { SkeletonTable } from '../components/ui/Skeleton';
import { useDebounce } from '../hooks/useDebounce';
import { officialService } from '../services/official.service';
import { roleAllows, useOfficialAuth } from '../stores/officialAuth';
import { AppError, CivicPriority, CivicStatus, OfficialReportFilters, Severity } from '../types';
import { classLabel, formatDateTime, formatPercent } from '../utils/format';

const STATUSES: CivicStatus[] = [
  'SUBMITTED', 'AI_ANALYSIS', 'AI_ANALYSED', 'UNDER_REVIEW', 'VERIFIED',
  'REJECTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED',
];
const PRIORITIES: CivicPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const SEVERITIES: Severity[] = ['low', 'moderate', 'high'];

export function OfficialReportsPage() {
  const { official } = useOfficialAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const overdueOnly = searchParams.get('overdueOnly') === 'true';
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [priority, setPriority] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [assignedOfficialId, setAssignedOfficialId] = useState('');
  const [damageType, setDamageType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<OfficialReportFilters['sort']>('createdAt_desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<CivicStatus>('UNDER_REVIEW');
  const [bulkNote, setBulkNote] = useState('');

  const updateOverdueOnly = (checked: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (checked) next.set('overdueOnly', 'true');
    else next.delete('overdueOnly');
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  const filters = useMemo<OfficialReportFilters>(
    () => ({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      status: (status || undefined) as CivicStatus | undefined,
      severity: (severity || undefined) as Severity | undefined,
      priority: (priority || undefined) as CivicPriority | undefined,
      departmentId: departmentId || undefined,
      assignedOfficialId: assignedOfficialId || undefined,
      damageType: damageType || undefined,
      from: from || undefined,
      to: to || undefined,
      overdueOnly,
      sort,
    }),
    [page, debouncedSearch, status, severity, priority, departmentId, assignedOfficialId, damageType, from, to, overdueOnly, sort],
  );

  const reports = useQuery({
    queryKey: ['official-reports', filters],
    queryFn: () => officialService.reports(filters),
  });
  const departments = useQuery({ queryKey: ['official-departments'], queryFn: officialService.departments });
  const canManage = roleAllows(official, ['SUPER_ADMIN', 'ADMIN']);
  const canExport = roleAllows(official, ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_OFFICIAL']);
  const officials = useQuery({
    queryKey: ['official-accounts'],
    queryFn: officialService.officials,
    enabled: canManage,
    retry: false,
  });

  const bulkMutation = useMutation({
    mutationFn: () => officialService.bulkStatus([...selected], bulkStatus, bulkNote || undefined),
    onSuccess: () => {
      setBulkOpen(false);
      setSelected(new Set());
      setBulkNote('');
      void queryClient.invalidateQueries({ queryKey: ['official-reports'] });
      void queryClient.invalidateQueries({ queryKey: ['official-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['official-audit'] });
    },
  });

  const items = reports.data?.items ?? [];
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const toggleAll = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) items.forEach((item) => next.delete(item.id));
      else items.forEach((item) => next.add(item.id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetFilters = (event?: FormEvent) => {
    event?.preventDefault();
    setSearch('');
    setStatus('');
    setSeverity('');
    setPriority('');
    setDepartmentId('');
    setAssignedOfficialId('');
    setDamageType('');
    setFrom('');
    setTo('');
    updateOverdueOnly(false);
    setSort('createdAt_desc');
    setPage(1);
  };

  const exportCsv = () => {
    window.location.assign(officialService.exportCsvUrl(filters));
  };

  return (
    <OfficialLayout>
      <OfficialPageHeader
        title="Citizen reports"
        description="Search, filter, sort and act on real stored cases. Exact coordinates shown here are official-only."
        actions={
          <>
            {canExport ? (
              <Button variant="outline" icon={<Download size={15} />} onClick={exportCsv}>Export CSV</Button>
            ) : null}
            {canManage && selected.size > 0 ? (
              <Button onClick={() => setBulkOpen(true)}>Bulk status ({selected.size})</Button>
            ) : null}
          </>
        }
      />

      <Card className="mb-6" title="Filters" description="Server-side validation and filtering — no client-only access control.">
        <form className="grid gap-4 lg:grid-cols-4" onSubmit={(event) => event.preventDefault()}>
          <Input label="Search report ID / status / assignment" name="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="RVR-2026-…" />
          <Select label="Status" name="status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} options={[{ value: '', label: 'All statuses' }, ...STATUSES.map((value) => ({ value, label: value.replace(/_/g, ' ') }))]} />
          <Select label="Severity" name="severity" value={severity} onChange={(event) => { setSeverity(event.target.value); setPage(1); }} options={[{ value: '', label: 'All severities' }, ...SEVERITIES.map((value) => ({ value, label: value }))]} />
          <Select label="Priority" name="priority" value={priority} onChange={(event) => { setPriority(event.target.value); setPage(1); }} options={[{ value: '', label: 'All priorities' }, ...PRIORITIES.map((value) => ({ value, label: value }))]} />
          <Select label="Department" name="departmentId" value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setPage(1); }} options={[{ value: '', label: 'All departments' }, ...(departments.data?.departments ?? []).map((department) => ({ value: department.id, label: department.name }))]} />
          {canManage ? (
            <Select label="Assigned official" name="assignedOfficialId" value={assignedOfficialId} onChange={(event) => { setAssignedOfficialId(event.target.value); setPage(1); }} options={[{ value: '', label: 'All officials' }, ...(officials.data?.officials ?? []).map((account) => ({ value: account.id, label: account.name }))]} />
          ) : null}
          <Input label="Damage type" name="damageType" value={damageType} onChange={(event) => { setDamageType(event.target.value); setPage(1); }} placeholder="pothole" />
          <Input label="From date" name="from" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
          <Input label="To date" name="to" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
          <Select label="Sort" name="sort" value={sort} onChange={(event) => { setSort(event.target.value as OfficialReportFilters['sort']); setPage(1); }} options={[
            { value: 'createdAt_desc', label: 'Newest first' },
            { value: 'createdAt_asc', label: 'Oldest first' },
            { value: 'severity_desc', label: 'Severity' },
            { value: 'priority_desc', label: 'Priority' },
          ]} />
          <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={overdueOnly} onChange={(event) => updateOverdueOnly(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Overdue only
          </label>
          <div className="flex items-end gap-2 lg:col-span-2">
            <Button variant="outline" icon={<Filter size={15} />} onClick={() => resetFilters()}>Reset filters</Button>
            <span className="pb-2 text-xs text-slate-500">{reports.data?.total ?? 0} matching reports</span>
          </div>
        </form>
      </Card>

      {reports.isError ? <Alert tone="danger">Could not load official reports.</Alert> : null}
      {reports.isLoading ? <SkeletonTable rows={8} cols={8} /> : items.length === 0 ? (
        <EmptyState title="No reports match these filters" description="Try widening the date range or clearing filters." action={{ label: 'Reset filters', onClick: () => resetFilters() }} />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {canManage ? (
                    <th className="w-10 px-3 py-3">
                      <input type="checkbox" aria-label="Select all visible reports" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-slate-300" />
                    </th>
                  ) : <th className="w-4" />}
                  <th className="px-4 py-3">Report ID</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Damage</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Official</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50/70">
                    {canManage ? (
                      <td className="px-3 py-3">
                        <input type="checkbox" aria-label={`Select ${report.publicReportId}`} checked={selected.has(report.id)} onChange={() => toggleOne(report.id)} className="h-4 w-4 rounded border-slate-300" />
                      </td>
                    ) : <td />}
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {report.publicReportId}
                      {report.suspicious ? <Badge tone="warning" className="ml-2">Review</Badge> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(report.createdAt)}</td>
                    <td className="px-4 py-3">{report.ai.damageType ? classLabel(report.ai.damageType) : '—'}</td>
                    <td className="px-4 py-3"><SeverityBadge severity={report.aiSeverity} /></td>
                    <td className="px-4 py-3 tabular">{report.ai.confidence !== null ? formatPercent(report.ai.confidence) : '—'}</td>
                    <td className="px-4 py-3 tabular text-xs text-slate-600">
                      {report.exactLocation.latitude.toFixed(4)}, {report.exactLocation.longitude.toFixed(4)}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={report.status} /></td>
                    <td className="px-4 py-3 text-xs">
                      {report.officialDecision.departmentName ?? '—'}
                      <PriorityBadge priority={report.priority} />
                    </td>
                    <td className="px-4 py-3 text-xs">{report.officialDecision.assignedOfficialName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Link to={`/official/reports/${report.id}`} className="font-semibold text-brand-700 hover:underline">Open case</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 p-4">
            <Pagination
              page={reports.data?.page ?? 1}
              limit={reports.data?.limit ?? 20}
              total={reports.data?.total ?? 0}
              onChange={setPage}
            />
          </div>
        </Card>
      )}

      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Confirm bulk status update"
        description={`This will attempt to update ${selected.size} selected report(s). Each change is audited.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button loading={bulkMutation.isPending} onClick={() => bulkMutation.mutate()}>Confirm update</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="New status" name="bulkStatus" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as CivicStatus)} options={STATUSES.filter((value) => !['AI_ANALYSIS', 'AI_ANALYSED', 'SUBMITTED'].includes(value)).map((value) => ({ value, label: value.replace(/_/g, ' ') }))} />
          <Textarea label="Internal note" name="bulkNote" value={bulkNote} onChange={(event) => setBulkNote(event.target.value)} placeholder="Optional context for the audit log" />
          {bulkMutation.isError ? (
            <Alert tone="danger">{bulkMutation.error instanceof AppError ? bulkMutation.error.message : 'Bulk update failed.'}</Alert>
          ) : null}
        </div>
      </Modal>
    </OfficialLayout>
  );
}
