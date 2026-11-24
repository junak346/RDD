import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Cpu,
  Clock,
  FileText,
  MapPin,
  ShieldAlert,
} from 'lucide-react';

import { DetectionList } from '../components/analysis/DetectionList';
import { ImageViewer } from '../components/analysis/ImageViewer';
import { PageHeader } from '../components/layout/AppShell';
import { Alert } from '../components/ui/Alert';
import { Badge, DemoBadge, SeverityBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton';
import { inspectionsService } from '../services/inspections.service';
import { useToast } from '../stores/toast';
import { classLabel, formatBytes, formatDateTime, formatPercent, truncateId } from '../utils/format';

export function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const detail = useQuery({
    queryKey: ['inspections', 'detail', id],
    queryFn: () => inspectionsService.get(id!),
    enabled: Boolean(id),
  });

  if (detail.isLoading) {
    return (
      <div>
        <PageHeader title="Inspection report" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="aspect-video w-full" />
          <SkeletonCard lines={5} />
        </div>
      </div>
    );
  }

  if (detail.error || !detail.data) {
    return (
      <div>
        <PageHeader title="Inspection report" />
        <ErrorState
          title="Report unavailable"
          message="This inspection could not be loaded — it may have been deleted."
          onRetry={() => detail.refetch()}
        />
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => navigate('/app/history')}>
            Back to history
          </Button>
        </div>
      </div>
    );
  }

  const inspection = detail.data;
  const avgConfidence =
    inspection.detections.length > 0
      ? inspection.detections.reduce((sum, d) => sum + d.confidence, 0) / inspection.detections.length
      : null;

  return (
    <div>
      <PageHeader
        title="Inspection report"
        description={`#${truncateId(inspection.id, 12)} · ${formatDateTime(inspection.createdAt)}`}
        actions={
          <>
            <Button variant="outline" size="sm" icon={<ArrowLeft size={14} />} onClick={() => navigate('/app/history')}>
              History
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={async () => {
                try {
                  await inspectionsService.remove(inspection.id);
                  queryClient.invalidateQueries({ queryKey: ['inspections'] });
                  toast.success('Inspection deleted');
                  navigate('/app/history');
                } catch {
                  toast.error('Delete failed');
                }
              }}
            >
              Delete
            </Button>
          </>
        }
      />

      {inspection.model.demo ? (
        <Alert tone="warning" className="mb-6" title="DEMO results — not real inference">
          This report was produced by the labelled demo engine{' '}
          <code className="rounded bg-amber-100 px-1">{inspection.model.name}</code> ({inspection.model.version}).
          It does not come from a trained model. See docs/AI_MODEL.md to install real weights.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Images */}
        <div>
          <ImageViewer
            originalUrl={inspection.image.url}
            annotatedUrl={inspection.annotatedImage?.url ?? null}
            detections={inspection.detections}
            imageWidth={inspection.image.width ?? 1}
            imageHeight={inspection.image.height ?? 1}
            hoveredIndex={hoveredIndex}
          />
          <Card title="Image file" className="mt-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Original name</dt>
                <dd className="mt-0.5 truncate font-medium text-slate-800">
                  {inspection.image.originalName ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Size / format</dt>
                <dd className="tabular mt-0.5 font-medium text-slate-800">
                  {formatBytes(inspection.image.size)} · {inspection.image.mimeType}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Dimensions</dt>
                <dd className="tabular mt-0.5 font-medium text-slate-800">
                  {inspection.image.width ?? '?'} × {inspection.image.height ?? '?'} px
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Status</dt>
                <dd className="mt-0.5">
                  <Badge tone={inspection.status === 'completed' ? 'success' : 'danger'}>
                    {inspection.status}
                  </Badge>
                </dd>
              </div>
            </dl>
          </Card>
        </div>

        {/* Detections + meta */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Detections" value={String(inspection.summary.detectionCount)} />
            <MiniStat
              label="Max severity"
              value={<SeverityBadge severity={inspection.summary.maxSeverity} />}
            />
            <MiniStat
              label="Avg confidence"
              value={avgConfidence != null ? formatPercent(avgConfidence) : '—'}
            />
            <MiniStat label="Processing" value={`${inspection.processingTimeMs.toFixed(0)} ms`} />
          </div>

          <Card title="AI detections" description="Hover a row to highlight it on the image." padded={false}>
            <DetectionList
              detections={inspection.detections}
              hoveredIndex={hoveredIndex}
              onHover={setHoveredIndex}
            />
          </Card>

          <Card title="Model information">
            <dl className="space-y-2.5 text-sm">
              <MetaRow icon={<Cpu size={14} />} label="Engine" value={`${inspection.model.engine} · ${inspection.model.name}`} />
              <MetaRow icon={<FileText size={14} />} label="Version" value={inspection.model.version} />
              {inspection.model.device ? (
                <MetaRow icon={<Cpu size={14} />} label="Device" value={inspection.model.device} />
              ) : null}
              <MetaRow
                icon={<ShieldAlert size={14} />}
                label="Mode"
                value={
                  <span className="flex items-center gap-2">
                    {inspection.model.demo ? 'Demo engine (synthetic)' : 'Trained model'}
                    {inspection.model.demo ? <DemoBadge /> : null}
                  </span>
                }
              />
              {inspection.model.confidenceThreshold != null ? (
                <MetaRow
                  icon={<Clock size={14} />}
                  label="Thresholds"
                  value={`conf ≥ ${inspection.model.confidenceThreshold} · IoU ${inspection.model.iouThreshold ?? '—'}`}
                />
              ) : null}
            </dl>
            {inspection.aiWarnings.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                {inspection.aiWarnings.map((warning) => (
                  <p key={warning} className="rounded bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}
          </Card>

          {inspection.location ? (
            <Card title="Location">
              <div className="flex items-start gap-2.5 text-sm">
                <MapPin size={16} className="mt-0.5 shrink-0 text-brand-600" />
                <div>
                  <p className="font-medium text-slate-800">
                    {inspection.location.address ?? 'Captured coordinates'}
                  </p>
                  <p className="tabular mt-0.5 text-xs text-slate-500">
                    {inspection.location.latitude.toFixed(5)},{' '}
                    {inspection.location.longitude.toFixed(5)}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2.5"
                    onClick={() => navigate('/app/map')}
                  >
                    View on map
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card title="Location">
              <p className="text-sm text-slate-500">
                No location was captured for this inspection.
              </p>
            </Card>
          )}

          <Alert tone="info" title="Interpretation guidance">
            Severity and confidence values are automated estimates derived from the detection
            characteristics. They do not replace a professional civil-engineering assessment.
          </Alert>
        </div>
      </div>

      {/* Category breakdown */}
      <Card title="Damage categories" className="mt-6">
        <div className="flex flex-wrap gap-2">
          {Object.entries(inspection.summary.countsByClass).map(([className, count]) => (
            <Badge key={className} tone="neutral" className="text-sm">
              <span className="font-semibold text-slate-900">{count}</span> {classLabel(className)}
            </Badge>
          ))}
          {Object.keys(inspection.summary.countsByClass).length === 0 ? (
            <p className="text-sm text-slate-500">No damage categories — nothing was detected.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="surface-card px-3.5 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="tabular mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-xs text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className="text-right text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}
