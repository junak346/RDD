import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  MapPin,
  ScanLine,
  UserCheck,
} from 'lucide-react';

import { PriorityBadge, StatusBadge } from '../components/official/OfficialBadges';
import { OfficialLayout, OfficialPageHeader } from '../components/layout/OfficialLayout';
import { Alert } from '../components/ui/Alert';
import { Badge, DemoBadge, SeverityBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { officialService, OfficialActionInput, OfficialActionName } from '../services/official.service';
import { roleAllows, useOfficialAuth } from '../stores/officialAuth';
import { AppError, CivicPriority } from '../types';
import { classLabel, formatDateTime, formatPercent } from '../utils/format';

interface PendingAction {
  action: OfficialActionName;
  title: string;
  description: string;
  requiresReason?: boolean;
  requiresNote?: boolean;
  tone?: 'danger' | 'warning';
}

export function OfficialReportDetailPage() {
  const { id = '' } = useParams();
  const { official } = useOfficialAuth();
  const queryClient = useQueryClient();
  const [imageMode, setImageMode] = useState<'original' | 'annotated'>('annotated');
  const [departmentId, setDepartmentId] = useState('');
  const [assignedOfficialId, setAssignedOfficialId] = useState('');
  const [priority, setPriority] = useState<CivicPriority>('MEDIUM');
  const [dueAt, setDueAt] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reportQuery = useQuery({
    queryKey: ['official-report', id],
    queryFn: () => officialService.report(id),
    enabled: Boolean(id),
  });
  const departments = useQuery({ queryKey: ['official-departments'], queryFn: officialService.departments });
  const canAssign = roleAllows(official, ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_OFFICIAL']);
  const canInspect = roleAllows(official, ['SUPER_ADMIN', 'ADMIN', 'INSPECTOR', 'DEPARTMENT_OFFICIAL']);
  const canRequestInspection = roleAllows(official, ['SUPER_ADMIN', 'ADMIN', 'INSPECTOR']);
  const canClose = roleAllows(official, ['SUPER_ADMIN', 'ADMIN']);
  const officials = useQuery({
    queryKey: ['official-accounts'],
    queryFn: officialService.officials,
    enabled: canAssign,
    retry: false,
  });

  const actionMutation = useMutation({
    mutationFn: (input: OfficialActionInput) => officialService.performAction(id, input),
    onSuccess: () => {
      setPending(null);
      setActionError(null);
      setNote('');
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['official-report', id] });
      void queryClient.invalidateQueries({ queryKey: ['official-reports'] });
      void queryClient.invalidateQueries({ queryKey: ['official-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['official-audit'] });
      void queryClient.invalidateQueries({ queryKey: ['official-notifications'] });
    },
    onError: (error) => {
      setActionError(error instanceof AppError ? error.message : 'The action could not be completed.');
    },
  });

  if (reportQuery.isLoading) {
    return <OfficialLayout><div className="flex justify-center py-20"><Spinner size="lg" label="Loading case" /></div></OfficialLayout>;
  }
  if (reportQuery.isError || !reportQuery.data) {
    return (
      <OfficialLayout>
        <Alert tone="danger" title="Case not found">This report is unavailable or you do not have permission to view it.</Alert>
        <Link to="/official/reports" className="mt-4 inline-block text-sm font-semibold text-brand-700 underline">Back to reports</Link>
      </OfficialLayout>
    );
  }

  const report = reportQuery.data.report;
  const annotated = imageMode === 'annotated' && report.annotatedImageUrl;
  const imageUrl = annotated ? report.annotatedImageUrl! : report.image.url;

  const runAction = (input: OfficialActionInput) => {
    setActionError(null);
    actionMutation.mutate(input);
  };

  const confirmPending = () => {
    if (!pending) return;
    const input: OfficialActionInput = { action: pending.action };
    if (pending.requiresReason) {
      if (!reason.trim()) {
        setActionError('A reason is required for this action.');
        return;
      }
      input.reason = reason.trim();
    }
    if (pending.requiresNote) {
      if (!note.trim()) {
        setActionError('A note is required for this action.');
        return;
      }
      input.note = note.trim();
    }
    runAction(input);
  };

  const ask = (next: PendingAction) => {
    setActionError(null);
    setReason('');
    setNote('');
    setPending(next);
  };

  return (
    <OfficialLayout>
      <OfficialPageHeader
        title={`Case ${report.publicReportId}`}
        description="AI evidence and official decisions are separate. Every action below is recorded in the audit history."
        actions={
          <Link to="/official/reports">
            <Button variant="outline" icon={<ArrowLeft size={15} />}>Back to reports</Button>
          </Link>
        }
      />

      {report.ai.demo ? (
        <Alert tone="warning" className="mb-5" title="DEMO MODE — not trained inference">
          Model: {report.ai.model?.name ?? 'demo'} · version {report.ai.modelVersion ?? 'unknown'}. Confidence
          and severity are heuristic/demo estimates, not calibrated predictions or an engineering verdict.
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card
            title="Captured evidence"
            description="Protected image retrieval — only authorized official sessions can load these URLs."
            actions={
              <div className="flex gap-1 rounded-md bg-slate-100 p-1">
                <button type="button" onClick={() => setImageMode('original')} className={`rounded px-2.5 py-1 text-xs font-medium ${imageMode === 'original' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Original</button>
                <button type="button" onClick={() => setImageMode('annotated')} disabled={!report.annotatedImageUrl} className={`rounded px-2.5 py-1 text-xs font-medium disabled:opacity-40 ${imageMode === 'annotated' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>AI annotated</button>
              </div>
            }
          >
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
              <img src={imageUrl} alt={imageMode === 'annotated' ? 'AI annotated road damage evidence' : 'Original citizen camera photo'} className="max-h-[560px] w-full object-contain" />
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
              <span>{report.image.width ?? '—'} × {report.image.height ?? '—'} px</span>
              <span>{report.image.format.toUpperCase()}</span>
              <span>Captured {formatDateTime(report.image.capturedAt)}</span>
              <span>Uploaded {formatDateTime(report.image.uploadedAt)}</span>
              {report.ai.demo ? <DemoBadge /> : null}
            </div>
          </Card>

          <Card title="AI result" description="Assistive computer-vision analysis — not a final government decision.">
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Likely damage</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {report.noDamageDetected ? 'No road damage detected.' : report.ai.damageType ? classLabel(report.ai.damageType) : 'Pending'}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Confidence</p>
                <p className="mt-1 font-semibold text-slate-900">{report.ai.confidence !== null ? formatPercent(report.ai.confidence, 1) : '—'}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Estimated severity</p>
                <div className="mt-1"><SeverityBadge severity={report.aiSeverity} /></div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs uppercase text-slate-500">Processing</p>
                <p className="mt-1 font-semibold text-slate-900">{report.ai.processingTimeMs !== null ? `${report.ai.processingTimeMs.toFixed(0)} ms` : '—'}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
              <p><strong>Model:</strong> {report.ai.model?.name ?? '—'} · v{report.ai.modelVersion ?? '—'}</p>
              <p><strong>Engine:</strong> {report.ai.model?.engine ?? '—'}</p>
              <p><strong>Configured confidence threshold:</strong> {report.ai.confidenceThreshold ?? '—'}</p>
              <p><strong>Analysis timestamp:</strong> {report.ai.analysedAt ? formatDateTime(report.ai.analysedAt) : '—'}</p>
            </div>
            {report.ai.warnings.length ? (
              <Alert tone="warning" className="mt-4" title="Model warnings">{report.ai.warnings.join(' ')}</Alert>
            ) : null}

            <h3 className="mt-6 text-sm font-semibold text-slate-900">Detection boxes</h3>
            {report.ai.detections.length ? (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr><th className="px-3 py-2">Class</th><th className="px-3 py-2">Confidence</th><th className="px-3 py-2">Severity</th><th className="px-3 py-2">Bounding box</th><th className="px-3 py-2">Segmentation</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.ai.detections.map((detection, index) => (
                      <tr key={`${detection.className}-${index}`}>
                        <td className="px-3 py-2 font-medium">{classLabel(detection.className)}</td>
                        <td className="px-3 py-2 tabular">{formatPercent(detection.confidence, 1)}</td>
                        <td className="px-3 py-2"><SeverityBadge severity={detection.severity} /></td>
                        <td className="px-3 py-2 tabular text-slate-500">
                          [{detection.bbox.x1.toFixed(0)}, {detection.bbox.y1.toFixed(0)}, {detection.bbox.x2.toFixed(0)}, {detection.bbox.y2.toFixed(0)}]
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {detection.segmentation?.length
                            ? `${detection.segmentation.length} polygon points`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No detection boxes above the configured confidence threshold.</p>
            )}
          </Card>

          <Card title="Internal notes" description="Private operational notes are never exposed through public tracking.">
            {report.internalNotes.length ? (
              <ul className="space-y-3">
                {report.internalNotes.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="text-slate-700">{entry.text}</p>
                    <p className="mt-1 text-xs text-slate-500">{entry.authorName} · {formatDateTime(entry.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-500">No internal notes have been added.</p>}
          </Card>

          <Card title="Action history" description="Append-only case timeline; officials cannot silently change this history.">
            <ol className="relative ml-2 border-l border-slate-200">
              {report.actionHistory.map((entry) => (
                <li key={entry.id} className="relative pb-4 pl-6 last:pb-0">
                  <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" aria-hidden />
                  <p className="text-sm font-medium text-slate-900">{entry.action.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-500">{entry.actor} · {entry.role.replace(/_/g, ' ')} · {formatDateTime(entry.timestamp)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Official decision" description="Administrative fields, deliberately separate from AI severity.">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd><StatusBadge status={report.status} /></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Priority</dt><dd><PriorityBadge priority={report.priority} /></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Department</dt><dd className="text-right font-medium">{report.officialDecision.departmentName ?? 'Unassigned'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Assigned official</dt><dd className="text-right font-medium">{report.officialDecision.assignedOfficialName ?? 'Unassigned'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Due</dt><dd className="text-right font-medium">{report.officialDecision.dueAt ? formatDateTime(report.officialDecision.dueAt) : 'No configured due date'}</dd></div>
              {report.officialDecision.overdue ? <Badge tone="danger">Overdue</Badge> : null}
            </dl>
          </Card>

          <Card title="Exact location" description="Authorized officials only — public tracking receives a coarse area.">
            <div className="h-56 overflow-hidden rounded-lg border border-slate-200">
              <MapContainer center={[report.exactLocation.latitude, report.exactLocation.longitude]} zoom={16} scrollWheelZoom={false}>
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <CircleMarker center={[report.exactLocation.latitude, report.exactLocation.longitude]} radius={10} pathOptions={{ color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.75 }}>
                  <Popup>{report.publicReportId} · {report.status.replace(/_/g, ' ')}</Popup>
                </CircleMarker>
              </MapContainer>
            </div>
            <p className="mt-3 flex gap-2 text-sm text-slate-700"><MapPin size={16} className="mt-0.5 text-brand-600" /> {report.exactLocation.latitude.toFixed(6)}, {report.exactLocation.longitude.toFixed(6)}</p>
            <p className="mt-1 text-xs text-slate-500">Accuracy {Math.round(report.exactLocation.accuracy)} m · captured {formatDateTime(report.exactLocation.capturedAt)}</p>
          </Card>

          <Card title="Incident grouping" description="Likely duplicate reports are preserved and grouped, not deleted.">
            <p className="text-sm text-slate-700">
              {report.incident.publicIncidentId
                ? <>Incident <strong>{report.incident.publicIncidentId}</strong> · {report.incident.citizenReportCount} citizen reports</>
                : 'No grouped incident for this report yet.'}
            </p>
            {report.suspicious ? <Badge tone="warning" className="mt-3">Suspicious submission flagged</Badge> : null}
          </Card>

          <Card title="Case actions" description="Server-side role checks are applied to every action.">
            {actionError ? <Alert tone="danger" className="mb-4">{actionError}</Alert> : null}
            {!canInspect ? (
              <Alert tone="info">Your role has read-only access to reports.</Alert>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" icon={<CheckCircle2 size={14} />} disabled={actionMutation.isPending} onClick={() => runAction({ action: 'VERIFY_REPORT' })}>Verify</Button>
                  <Button variant="danger" size="sm" icon={<FileWarning size={14} />} disabled={actionMutation.isPending} onClick={() => ask({ action: 'REJECT_REPORT', title: 'Reject this report?', description: 'This is a destructive decision and will be recorded. Provide a reason.', requiresReason: true, tone: 'danger' })}>Reject</Button>
                  {canRequestInspection ? (
                    <Button variant="outline" size="sm" icon={<ClipboardCheck size={14} />} disabled={actionMutation.isPending} onClick={() => runAction({ action: 'REQUEST_INSPECTION', note: note.trim() || undefined })}>Inspect</Button>
                  ) : null}
                  <Button variant="outline" size="sm" icon={<ScanLine size={14} />} disabled={actionMutation.isPending} onClick={() => runAction({ action: 'MARK_IN_PROGRESS' })}>In progress</Button>
                </div>

                {canAssign ? (
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <Select label="Assign department" name="departmentId" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} options={[{ value: '', label: 'Choose department' }, ...(departments.data?.departments ?? []).map((department) => ({ value: department.id, label: department.name }))]} />
                    <Button size="sm" variant="outline" icon={<Building2 size={14} />} disabled={!departmentId || actionMutation.isPending} onClick={() => runAction({ action: 'ASSIGN_DEPARTMENT', departmentId, dueAt: dueAt || undefined })}>Assign department</Button>
                    <Select label="Assign official" name="assignedOfficialId" value={assignedOfficialId} onChange={(event) => setAssignedOfficialId(event.target.value)} options={[{ value: '', label: 'Choose official' }, ...(officials.data?.officials ?? []).map((account) => ({ value: account.id, label: `${account.name} · ${account.designation}` }))]} />
                    <Button size="sm" variant="outline" icon={<UserCheck size={14} />} disabled={!assignedOfficialId || actionMutation.isPending} onClick={() => runAction({ action: 'ASSIGN_OFFICIAL', assignedOfficialId, dueAt: dueAt || undefined })}>Assign official</Button>
                    <Select label="Official priority" name="priority" value={priority} onChange={(event) => setPriority(event.target.value as CivicPriority)} options={['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => ({ value, label: value }))} />
                    <Input label="Optional due date" name="dueAt" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
                    <Button size="sm" variant="outline" disabled={actionMutation.isPending} onClick={() => runAction({ action: 'CHANGE_PRIORITY', priority, dueAt: dueAt || undefined })}>Change priority</Button>
                  </div>
                ) : null}

                <Textarea label="Internal note" name="note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add private operational context" />
                <Button size="sm" variant="outline" disabled={!note.trim() || actionMutation.isPending} onClick={() => runAction({ action: 'ADD_INTERNAL_NOTE', note: note.trim() })}>Add note</Button>

                <div className="grid grid-cols-2 gap-2">
                  {canAssign ? (
                    <Button size="sm" disabled={actionMutation.isPending} onClick={() => ask({ action: 'MARK_RESOLVED', title: 'Mark this case resolved?', description: 'Confirm only after the responsible department reports the work complete. This action is audited.', tone: 'warning' })}>Mark resolved</Button>
                  ) : null}
                  {canClose ? (
                    <Button size="sm" variant="secondary" disabled={actionMutation.isPending} onClick={() => ask({ action: 'CLOSE_CASE', title: 'Close this case?', description: 'Closing is restricted to administrators and is recorded in the audit history.', tone: 'warning' })}>Close case</Button>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500">Permanent deletion is not available to ordinary officials; archive/retention policy is handled server-side.</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={pending?.title ?? 'Confirm action'}
        description={pending?.description}
        footer={
          <>
            <Button variant="outline" onClick={() => setPending(null)}>Cancel</Button>
            <Button variant={pending?.tone === 'danger' ? 'danger' : 'primary'} loading={actionMutation.isPending} onClick={confirmPending}>Confirm</Button>
          </>
        }
      >
        {pending?.requiresReason ? (
          <Textarea label="Reason" name="reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this report is rejected" />
        ) : pending?.requiresNote ? (
          <Textarea label="Note" name="confirmNote" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Enter a note" />
        ) : (
          <p className="text-sm text-slate-600">Please confirm this official decision.</p>
        )}
        {actionError ? <Alert tone="danger" className="mt-4">{actionError}</Alert> : null}
      </Modal>
    </OfficialLayout>
  );
}
