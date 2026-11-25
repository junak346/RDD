import { FormEvent, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, CircleDot, Clock3, MapPin, Search, ShieldCheck } from 'lucide-react';

import { PublicLayout } from '../components/layout/PublicLayout';
import { Alert } from '../components/ui/Alert';
import { Badge, DemoBadge, SeverityBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { reportsService } from '../services/reports.service';
import { AppError, PublicReportStatus } from '../types';
import { cn } from '../utils/cn';
import { classLabel, formatDateTime, formatPercent } from '../utils/format';

function statusTone(status: string): 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'RESOLVED' || status === 'CLOSED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'IN_PROGRESS' || status === 'ASSIGNED') return 'info';
  if (status === 'UNDER_REVIEW' || status === 'VERIFIED') return 'warning';
  return 'brand';
}

function Timeline({ report }: { report: PublicReportStatus }) {
  return (
    <ol className="relative ml-3 border-l-2 border-slate-200" role="list">
      {report.timeline.map((step, index) => (
        <li key={step.key} className="relative pb-7 pl-8 last:pb-0">
          <span
            className={cn(
              'absolute -left-[13px] top-0 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white',
              step.state === 'complete' && 'bg-emerald-500 text-white',
              step.state === 'current' && 'bg-brand-600 text-white',
              step.state === 'pending' && 'bg-slate-200 text-slate-400',
            )}
            aria-hidden
          >
            {step.state === 'complete' ? <Check size={13} /> : step.state === 'current' ? <CircleDot size={13} /> : <Clock3 size={12} />}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn('text-sm font-semibold', step.state === 'pending' ? 'text-slate-400' : 'text-slate-900')}>
              {step.label}
            </p>
            {step.state === 'current' ? <Badge tone="brand">Current</Badge> : null}
          </div>
          {index === 0 ? (
            <p className="mt-1 text-xs text-slate-500">{formatDateTime(report.submittedAt)}</p>
          ) : step.state === 'current' ? (
            <p className="mt-1 text-xs text-slate-500">Last updated {formatDateTime(report.lastUpdatedAt)}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function TrackPage() {
  const [params] = useSearchParams();
  const initialId = params.get('id')?.toUpperCase() || reportsService.rememberedReportId();
  const [reportId, setReportId] = useState(initialId);
  const [formError, setFormError] = useState<string | null>(null);
  const [report, setReport] = useState<PublicReportStatus | null>(null);

  const lookup = useMutation({
    mutationFn: (id: string) => reportsService.status(id),
    onSuccess: (data) => {
      setReport(data);
      reportsService.rememberReportId(data.publicReportId);
      setFormError(null);
    },
    onError: (error) => {
      setReport(null);
      setFormError(
        error instanceof AppError
          ? error.message
          : 'We could not check that report. Please verify the ID and try again.',
      );
    },
  });

  useEffect(() => {
    if (initialId) lookup.mutate(initialId);
    // Only prefill once when the page opens with a report ID.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = reportId.trim().toUpperCase();
    if (!/^RVR-\d{4}-[A-Z0-9]{10}$/.test(normalized)) {
      setFormError('Enter a valid report ID, for example RVR-2026-7K92M4QX8P.');
      setReport(null);
      return;
    }
    lookup.mutate(normalized);
  };

  return (
    <PublicLayout>
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-600">Public tracking</span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Check report status</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Enter the report ID you received after submission. No account is required. Exact GPS,
            captured images, internal notes and official identities are never shown here.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            label="Report ID"
            name="reportId"
            value={reportId}
            onChange={(event) => setReportId(event.target.value.toUpperCase())}
            placeholder="RVR-2026-7K92M4QX8P"
            autoComplete="off"
            spellCheck={false}
            error={formError ?? undefined}
          />
          <div className="flex items-end">
            <Button type="submit" size="lg" icon={<Search size={17} />} loading={lookup.isPending} className="w-full sm:w-auto">
              Check status
            </Button>
          </div>
        </form>

        {report ? (
          <div className="mt-9 grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3" title="Report timeline" description="Limited public lifecycle view.">
              <Timeline report={report} />
            </Card>
            <div className="space-y-5 lg:col-span-2">
              <Card title="Report reference">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded-lg bg-slate-100 px-3 py-2 text-base font-bold tracking-wide text-slate-900">
                    {report.publicReportId}
                  </code>
                  <Badge tone={statusTone(report.status)}>{report.status.replace(/_/g, ' ')}</Badge>
                  {report.aiDemo ? <DemoBadge /> : null}
                </div>
                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Submitted</dt>
                    <dd className="text-right font-medium text-slate-800">{formatDateTime(report.submittedAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Last updated</dt>
                    <dd className="text-right font-medium text-slate-800">{formatDateTime(report.lastUpdatedAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">General location</dt>
                    <dd className="text-right font-medium text-slate-800">{report.generalLocation.area}</dd>
                  </div>
                </dl>
                <p className="mt-3 flex gap-2 text-xs text-slate-500">
                  <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden />
                  Coarse area only · reported GPS accuracy {report.generalLocation.accuracyMeters} m
                </p>
              </Card>

              <Card title="AI result" description="Assistive estimate, not an official verdict.">
                {report.aiDemo ? (
                  <Alert tone="warning" className="mb-4" title="DEMO MODE">
                    Results are from the labelled demo engine, not trained model inference.
                  </Alert>
                ) : null}
                <p className="text-sm font-medium text-slate-900">
                  {report.noDamageDetected
                    ? 'No road damage detected.'
                    : report.aiPending
                      ? 'AI analysis is pending or temporarily unavailable.'
                      : report.detectedDamageType
                        ? `AI detected a likely ${classLabel(report.detectedDamageType).toLowerCase()}.`
                        : report.message}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <SeverityBadge severity={report.severity} />
                  {report.confidence !== null ? (
                    <span className="text-xs text-slate-500">Confidence {formatPercent(report.confidence, 0)}</span>
                  ) : null}
                </div>
              </Card>
            </div>
          </div>
        ) : !lookup.isPending && !formError ? (
          <Card className="mt-9" title="No report loaded">
            <p className="text-sm text-slate-600">
              Enter your report reference above to see its current public status.
            </p>
            <Link to="/report" className="mt-3 inline-block text-sm font-semibold text-brand-700 underline">
              Report new road damage
            </Link>
          </Card>
        ) : null}

        <p className="mt-8 flex gap-2 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />
          This page does not expose another citizen’s private report, exact coordinates or uploaded
          image. Treat your report ID as a reference token and share it only with people you trust.
        </p>
      </section>
    </PublicLayout>
  );
}
