import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, ScanLine, ShieldCheck } from 'lucide-react';

import { PublicLayout } from '../components/layout/PublicLayout';
import { Alert } from '../components/ui/Alert';
import { Badge, DemoBadge, SeverityBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { reportsService } from '../services/reports.service';
import { AppError } from '../types';
import { classLabel, formatDateTime, formatPercent } from '../utils/format';

export function ReportSuccessPage() {
  const { publicId = '' } = useParams();
  const [copied, setCopied] = useState(false);
  const query = useQuery({
    queryKey: ['public-report', publicId],
    queryFn: () => reportsService.status(publicId),
    enabled: Boolean(publicId),
    retry: false,
  });

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(publicId);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const report = query.data;

  return (
    <PublicLayout>
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        {query.isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" label="Loading report" /></div>
        ) : query.isError ? (
          <Alert tone="danger" title="Report not found">
            {query.error instanceof AppError ? query.error.message : 'We could not find that report reference.'}{' '}
            <Link to="/track" className="font-semibold underline">Try tracking again</Link>.
          </Alert>
        ) : report ? (
          <>
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200">
                <CheckCircle2 size={32} aria-hidden />
              </div>
              <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Your report has been submitted.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
                Keep this reference. It is an unguessable capability ID — anyone with it can see limited
                public status, but not exact coordinates, images or government notes.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <code className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-lg font-bold tracking-wider text-slate-900">
                  {report.publicReportId}
                </code>
                <Button variant="outline" icon={<ClipboardCheck size={16} />} onClick={() => void copyId()}>
                  {copied ? 'Copied' : 'Copy ID'}
                </Button>
              </div>
            </div>

            <Card className="mt-9" title="Initial assessment" description="Assistive AI result — not an official decision.">
              {report.aiDemo ? (
                <Alert tone="warning" className="mb-5" title="DEMO MODE">
                  No trained model weights are installed. These results come from the clearly-labelled
                  demo engine and are not calibrated model predictions.
                </Alert>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">AI detection</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {report.noDamageDetected
                      ? 'No road damage detected.'
                      : report.aiPending
                        ? 'AI analysis pending'
                        : report.detectedDamageType
                          ? `AI detected a likely ${classLabel(report.detectedDamageType).toLowerCase()}.`
                          : 'Report received.'}
                  </p>
                  {report.confidence !== null ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Confidence {formatPercent(report.confidence, 0)} · estimate, not a guarantee
                    </p>
                  ) : null}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Estimated severity</p>
                  <div className="mt-2"><SeverityBadge severity={report.severity} /></div>
                  <p className="mt-3 text-xs text-slate-500">
                    Submitted {formatDateTime(report.submittedAt)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge tone="brand">{report.status.replace(/_/g, ' ')}</Badge>
                {report.aiDemo ? <DemoBadge /> : null}
              </div>
            </Card>

            <Card className="mt-5" title="What happens next">
              <ol className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-3"><ScanLine size={16} className="mt-0.5 text-brand-600" /> AI evidence is stored for authorized review.</li>
                <li className="flex gap-3"><ShieldCheck size={16} className="mt-0.5 text-brand-600" /> Government officials verify, prioritize and assign the case.</li>
                <li className="flex gap-3"><CheckCircle2 size={16} className="mt-0.5 text-brand-600" /> Use your report ID to follow progress without an account.</li>
              </ol>
            </Card>

            <p className="mt-5 flex gap-2 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />
              Your camera image and location are used to analyse and manage this report. Public tracking
              shows only a coarse area; exact GPS is available only to authorized officials.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to={`/track?id=${encodeURIComponent(report.publicReportId)}`} className="flex-1">
                <Button size="lg" className="w-full">Check report status</Button>
              </Link>
              <Link to="/" className="flex-1">
                <Button size="lg" variant="outline" className="w-full">Back to home</Button>
              </Link>
            </div>
          </>
        ) : null}
      </section>
    </PublicLayout>
  );
}
