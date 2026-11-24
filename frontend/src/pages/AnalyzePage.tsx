import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, MapPin, ScanLine, Zap } from 'lucide-react';

import { AnalysisProgress } from '../components/analysis/AnalysisProgress';
import { DetectionList } from '../components/analysis/DetectionList';
import { Dropzone } from '../components/analysis/Dropzone';
import { ImageViewer } from '../components/analysis/ImageViewer';
import { PageHeader } from '../components/layout/AppShell';
import { Alert } from '../components/ui/Alert';
import { Badge, DemoBadge, SeverityBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { useGeolocation } from '../hooks/useGeolocation';
import { inspectionsService } from '../services/inspections.service';
import { useToast } from '../stores/toast';
import { AppError, Inspection } from '../types';
import { classLabel, formatDateTime } from '../utils/format';

export function AnalyzePage() {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const geolocation = useGeolocation();

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [uploadFraction, setUploadFraction] = useState<number | null>(null);
  const [phase, setPhase] = useState<'uploading' | 'analysing' | null>(null);
  const [result, setResult] = useState<Inspection | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const analysis = useMutation({
    mutationFn: async () => {
      if (!file) throw new AppError('NO_FILE', 'Select an image first.');
      setPhase('uploading');
      setUploadFraction(0);

      const lat = manualLat ? Number(manualLat) : geolocation.location?.latitude;
      const lng = manualLng ? Number(manualLng) : geolocation.location?.longitude;
      const location =
        lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng)
          ? { latitude: lat, longitude: lng, ...(address.trim() ? { address: address.trim() } : {}) }
          : null;

      return inspectionsService.create(file, location, (fraction) => {
        setUploadFraction(fraction);
        if (fraction >= 1) setPhase('analysing');
      });
    },
    onSuccess: (inspection) => {
      setPhase(null);
      setResult(inspection);
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['map-reports'] });
      toast.success(
        'Analysis complete',
        `${inspection.summary.detectionCount} damage region${inspection.summary.detectionCount === 1 ? '' : 's'} found.`,
      );
    },
    onError: (error) => {
      setPhase(null);
      setUploadFraction(null);
      toast.error(
        'Analysis failed',
        error instanceof AppError ? error.message : 'Unexpected error — please try again.',
      );
    },
  });

  const reset = () => {
    setResult(null);
    setFile(null);
    setFileError(null);
    setHoveredIndex(null);
    analysis.reset();
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFileError(null);
    if (!file) {
      setFileError('Select a road image to analyse.');
      return;
    }
    analysis.mutate();
  };

  if (analysis.isPending || phase) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Analysing image" description="Your road image is being processed." />
        <AnalysisProgress uploadFraction={uploadFraction} phase={phase ?? 'analysing'} />
      </div>
    );
  }

  if (result) {
    return (
      <div>
        <PageHeader
          title="Analysis results"
          description={`Inspected ${formatDateTime(result.timestamp)} · processing ${result.processingTimeMs.toFixed(0)} ms`}
          actions={
            <>
              <Button variant="outline" onClick={reset}>
                Analyse another
              </Button>
              <Button onClick={() => navigate(`/app/inspections/${result.id}`)}>Full report</Button>
            </>
          }
        />

        {result.aiDemo ? (
          <Alert tone="warning" className="mb-6" title="Demo engine — not real inference">
            These detections come from the clearly-labelled demo engine
            (<code className="rounded bg-amber-100 px-1">{result.model.name}</code>), not a trained
            model. Install real weights (see <code className="rounded bg-amber-100 px-1">docs/AI_MODEL.md</code>) for
            genuine inference. Confidence values are heuristic scores, not calibrated probabilities.
          </Alert>
        ) : null}

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile label="Detections" value={String(result.summary.detectionCount)} />
          <SummaryTile
            label="Max severity"
            value={<SeverityBadge severity={result.summary.maxSeverity} />}
          />
          <SummaryTile
            label="Top class"
            value={
              Object.entries(result.summary.countsByClass).sort((a, b) => b[1] - a[1])[0]?.[0]
                ? classLabel(
                    Object.entries(result.summary.countsByClass).sort((a, b) => b[1] - a[1])[0][0],
                  )
                : '—'
            }
          />
          <SummaryTile
            label="Engine"
            value={
              <span className="flex items-center gap-1.5">
                {result.model.engine}
                {result.model.demo ? <DemoBadge /> : null}
              </span>
            }
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <ImageViewer
              originalUrl={result.image.url}
              annotatedUrl={result.annotatedImage?.url ?? null}
              detections={result.detections}
              imageWidth={result.image.width ?? 1}
              imageHeight={result.image.height ?? 1}
              hoveredIndex={hoveredIndex}
            />
          </div>
          <div className="lg:col-span-2">
            <Card
              title="Detected damage"
              description="Hover a row to highlight it on the image."
              padded={false}
            >
              <DetectionList
                detections={result.detections}
                hoveredIndex={hoveredIndex}
                onHover={setHoveredIndex}
              />
            </Card>
            {result.location ? (
              <Card title="Location" className="mt-4">
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-brand-600" />
                  <div>
                    <p>{result.location.address ?? 'Captured coordinates'}</p>
                    <p className="tabular mt-0.5 text-xs text-slate-400">
                      {result.location.latitude.toFixed(5)}, {result.location.longitude.toFixed(5)}
                    </p>
                  </div>
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Analyse road image"
        description="Upload a road photo — the AI service detects potholes, cracks and surface damage."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <form onSubmit={onSubmit} className="space-y-5 lg:col-span-3">
          <Dropzone
            file={file}
            onFile={(next) => {
              setFile(next);
              setFileError(null);
            }}
            onError={setFileError}
            disabled={analysis.isPending}
          />
          {fileError ? <Alert tone="danger">{fileError}</Alert> : null}

          <Card title="Location" description="Optional — analysis works fine without location data.">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={<MapPin size={14} />}
                  loading={geolocation.loading}
                  onClick={geolocation.capture}
                >
                  {geolocation.location ? 'Recapture GPS' : 'Use my location'}
                </Button>
                {geolocation.location ? (
                  <Badge tone="success">
                    {geolocation.location.latitude.toFixed(4)},{' '}
                    {geolocation.location.longitude.toFixed(4)}
                  </Badge>
                ) : null}
              </div>
              {geolocation.error ? (
                <Alert tone="warning">{geolocation.error}</Alert>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Latitude"
                  name="latitude"
                  inputMode="decimal"
                  placeholder="26.1445"
                  value={manualLat}
                  onChange={(event) => setManualLat(event.target.value)}
                />
                <Input
                  label="Longitude"
                  name="longitude"
                  inputMode="decimal"
                  placeholder="91.7362"
                  value={manualLng}
                  onChange={(event) => setManualLng(event.target.value)}
                />
              </div>
              <Input
                label="Address"
                name="address"
                placeholder="GS Road, Guwahati, Assam"
                optional
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            </div>
          </Card>

          <Button type="submit" size="lg" className="w-full" icon={<ScanLine size={18} />} disabled={!file}>
            Run AI analysis
          </Button>
        </form>

        <aside className="space-y-4 lg:col-span-2">
          <Card title="How it works">
            <ol className="space-y-3 text-sm text-slate-600">
              {[
                'Upload a clear road image (JPEG, PNG or WebP).',
                'The image is validated and sent to the inference service.',
                'A computer-vision model locates damage regions and classifies them.',
                'Severity is estimated from size, confidence and damage type.',
                'Results are stored in your inspection history.',
              ].map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Tips for best results">
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex gap-2">
                <Zap size={15} className="mt-0.5 shrink-0 text-amber-500" />
                Capture the road surface straight on, in good light.
              </li>
              <li className="flex gap-2">
                <Zap size={15} className="mt-0.5 shrink-0 text-amber-500" />
                Avoid heavy motion blur — keep the camera steady.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                Include some surrounding surface for context.
              </li>
            </ul>
          </Card>
          <Alert tone="info" title="About confidence & severity">
            Confidence expresses how strongly the model supports a detection — it is not a guarantee
            of real-world accuracy. Severity is an automated estimate, not a professional
            civil-engineering assessment.
          </Alert>
        </aside>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="surface-card px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="tabular mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}
