import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Check,
  CircleAlert,
  LocateFixed,
  LockKeyhole,
  MapPin,
  RefreshCw,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  X,
} from 'lucide-react';

import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { useCameraCapture } from '../hooks/useCameraCapture';
import { RequiredGeoLocation, useRequiredGeolocation } from '../hooks/useRequiredGeolocation';
import { reportsService } from '../services/reports.service';
import { AppError, PublicReportStatus } from '../types';
import { formatBytes, formatDateTime } from '../utils/format';

type Stage = 'intro' | 'requesting' | 'live' | 'preview' | 'confirm' | 'submitting' | 'error';

const PRIVACY_NOTICE =
  'Your camera image and location are collected to analyse and manage this road-damage report. Please avoid capturing unnecessary personal or sensitive information.';

function coarseArea(location: RequiredGeoLocation): string {
  return `${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}°`;
}

function isStale(location: RequiredGeoLocation | null): boolean {
  return Boolean(location && Date.now() - new Date(location.capturedAt).getTime() > 5 * 60 * 1000);
}

function LocationPill({ status, error }: { status: string; error: string | null }) {
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/30">
        <MapPin size={14} aria-hidden /> Location ready
      </span>
    );
  }
  if (status === 'requesting') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-200 ring-1 ring-inset ring-sky-400/30">
        <LocateFixed size={14} className="animate-pulse" aria-hidden /> Locating…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/30">
      <CircleAlert size={14} aria-hidden /> {error ? 'Location required' : 'Location not captured'}
    </span>
  );
}

function PrivacyNotice({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`flex gap-2 ${compact ? 'text-[11px]' : 'text-xs'} leading-relaxed text-slate-300`}>
      <ShieldCheck size={compact ? 14 : 16} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden />
      {PRIVACY_NOTICE}
    </p>
  );
}

export function CameraReportPage() {
  const navigate = useNavigate();
  const camera = useCameraCapture();
  const geo = useRequiredGeolocation();
  const [stage, setStage] = useState<Stage>('intro');
  const [uploadFraction, setUploadFraction] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = useMutation<PublicReportStatus, unknown, void>({
    mutationFn: async () => {
      if (!camera.photo || !geo.location) {
        throw new Error('A confirmed fresh photo and current location are required.');
      }
      if (isStale(geo.location)) {
        throw new Error('Location is no longer current. Please enable location again.');
      }
      setUploadFraction(0);
      return reportsService.create(camera.photo.blob, geo.location, setUploadFraction);
    },
    onSuccess: (report) => {
      reportsService.rememberReportId(report.publicReportId);
      camera.stop();
      navigate(`/report/success/${report.publicReportId}`, { state: { report } });
    },
    onError: (error) => {
      setStage('confirm');
      setSubmitError(
        error instanceof AppError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'The report could not be submitted. Please try again.',
      );
    },
  });

  const locationReady = geo.status === 'ready' && Boolean(geo.location) && !isStale(geo.location);
  const locationIssue = geo.error || (geo.location && isStale(geo.location)
    ? 'Location is no longer current. Please capture it again.'
    : null);

  const cameraIssue = camera.error;
  const photo = camera.photo;

  const requestPermissions = async (retry = false) => {
    setStage('requesting');
    setSubmitError(null);
    const cameraPromise = camera.start();
    if (!retry || geo.status !== 'ready') geo.capture();
    const cameraReady = await cameraPromise;
    setStage(cameraReady ? 'live' : 'error');
  };

  const retryCamera = async () => {
    setStage('requesting');
    const cameraReady = await camera.start();
    setStage(cameraReady ? 'live' : 'error');
  };

  const capturePhoto = async () => {
    const captured = await camera.capture();
    if (captured) setStage('preview');
  };

  const retakePhoto = async () => {
    const ready = await camera.retake();
    setStage(ready ? 'live' : 'error');
  };

  const confirmPhoto = () => {
    if (!locationReady) {
      geo.capture();
      return;
    }
    setStage('confirm');
  };

  const submitReport = () => {
    if (!photo || !locationReady) {
      setSubmitError('A confirmed fresh photo and current location are required.');
      return;
    }
    setSubmitError(null);
    setStage('submitting');
    submit.mutate();
  };

  const cancel = () => {
    camera.stop();
    camera.clearPhoto();
    geo.reset();
    navigate('/');
  };

  const statusMessage = useMemo(() => {
    if (cameraIssue) return cameraIssue;
    if (locationIssue) return locationIssue;
    if (submitError) return submitError;
    if (stage === 'requesting') return 'Requesting camera and location permissions…';
    if (stage === 'submitting') return 'Uploading and analysing your report…';
    return '';
  }, [cameraIssue, locationIssue, submitError, stage]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col sm:max-w-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label="RoadVision home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500">
              <ScanLine size={19} aria-hidden />
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em]">RoadVision</p>
              <p className="text-[10px] uppercase tracking-widest text-slate-400">Citizen reporting</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={cancel}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="Cancel report"
          >
            <X size={20} />
          </button>
        </header>

        <div aria-live="polite" className="sr-only">{statusMessage}</div>

        {stage === 'intro' ? (
          <main className="flex flex-1 flex-col justify-between px-5 py-8 sm:px-10">
            <div>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300 ring-1 ring-inset ring-brand-400/30">
                <Camera size={30} aria-hidden />
              </div>
              <h1 className="mt-7 text-center text-3xl font-bold tracking-tight sm:text-4xl">
                Report road damage
              </h1>
              <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-slate-300">
                Capture a fresh photo of the road and share where you found the damage. AI will analyse
                the road condition; an official will make the final decision.
              </p>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <LockKeyhole size={16} className="text-brand-300" aria-hidden />
                  Permissions needed
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  To report road damage, RoadVision needs:
                </p>
                <ul className="mt-4 space-y-3 text-sm text-slate-200">
                  <li className="flex gap-3">
                    <Camera size={17} className="mt-0.5 shrink-0 text-brand-300" aria-hidden />
                    Camera access to capture the road
                  </li>
                  <li className="flex gap-3">
                    <MapPin size={17} className="mt-0.5 shrink-0 text-brand-300" aria-hidden />
                    Location access to identify where the damage was found
                  </li>
                </ul>
                <p className="mt-4 rounded-lg bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
                  Browser permission prompts appear only after you continue. Camera and location
                  require HTTPS in production (localhost is allowed for development).
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <PrivacyNotice />
              <Button size="lg" className="w-full" icon={<Camera size={18} />} onClick={() => void requestPermissions()}>
                Continue
              </Button>
              <Button variant="ghost" className="w-full text-slate-300 hover:bg-white/10 hover:text-white" onClick={cancel}>
                Cancel
              </Button>
            </div>
          </main>
        ) : null}

        {stage === 'requesting' ? (
          <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <Spinner size="lg" label="Requesting permissions" />
            <h1 className="text-xl font-semibold">Preparing secure capture</h1>
            <p className="max-w-sm text-sm text-slate-300">
              Please respond to your browser’s camera and location permission prompts.
            </p>
            <LocationPill status={geo.status} error={geo.error} />
          </main>
        ) : null}

        {stage === 'error' ? (
          <main className="flex flex-1 flex-col justify-center gap-5 px-5 py-8 sm:px-10">
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5">
              <h1 className="flex items-center gap-2 text-xl font-semibold text-red-100">
                <CircleAlert size={20} aria-hidden /> Camera access was blocked
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-red-100/90">
                {cameraIssue ?? 'Camera access was blocked.'}
              </p>
              {cameraIssue?.includes('blocked') ? (
                <p className="mt-2 text-sm text-red-100/80">
                  Please allow camera access in your browser settings to report road damage.
                </p>
              ) : null}
            </div>
            {locationIssue ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
                <p className="text-sm font-semibold text-amber-100">
                  Location access is required to submit a road-damage report.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={geo.capture}>
                  Enable location
                </Button>
              </div>
            ) : null}
            <div className="flex gap-3">
              <Button className="flex-1" icon={<RefreshCw size={16} />} onClick={() => void retryCamera()}>
                Try again
              </Button>
              <Button variant="outline" className="flex-1" onClick={cancel}>
                Cancel
              </Button>
            </div>
          </main>
        ) : null}

        {stage === 'live' ? (
          <main className="flex flex-1 flex-col">
            <div className="relative flex-1 overflow-hidden bg-black">
              <video
                ref={camera.videoRef}
                autoPlay
                playsInline
                muted
                aria-label="Live camera preview"
                className="h-full min-h-[420px] w-full object-cover sm:min-h-[520px]"
              />
              <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
                <LocationPill status={geo.status} error={geo.error} />
                <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white/90">
                  Fresh photo only
                </span>
              </div>
              <div className="pointer-events-none absolute inset-8 rounded-2xl border border-white/30" aria-hidden />
            </div>
            <div className="border-t border-white/10 bg-slate-900 px-5 py-5">
              {locationIssue ? (
                <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
                  <p className="text-sm font-medium text-amber-100">
                    Location access is required to submit a road-damage report.
                  </p>
                  <p className="mt-1 text-xs text-amber-100/80">{locationIssue}</p>
                  <Button variant="outline" size="sm" className="mt-3" icon={<MapPin size={14} />} onClick={geo.capture}>
                    Enable location
                  </Button>
                </div>
              ) : null}
              <div className="flex items-center justify-center gap-6">
                <Button variant="ghost" className="text-slate-300 hover:bg-white/10 hover:text-white" onClick={cancel}>
                  Cancel
                </Button>
                <button
                  type="button"
                  onClick={() => void capturePhoto()}
                  aria-label="Capture photo"
                  className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/10 shadow-lg transition-transform active:scale-95"
                >
                  <span className="h-14 w-14 rounded-full bg-white" aria-hidden />
                </button>
                <div className="w-[72px] text-xs text-slate-400">Tap shutter</div>
              </div>
              <PrivacyNotice compact />
            </div>
          </main>
        ) : null}

        {stage === 'preview' && photo ? (
          <main className="flex flex-1 flex-col">
            <div className="relative flex-1 bg-black">
              <img
                src={photo.previewUrl}
                alt="Captured road photo preview"
                className="h-full min-h-[420px] w-full object-contain sm:min-h-[520px]"
              />
              <div className="absolute inset-x-0 top-0 flex justify-between p-4">
                <LocationPill status={geo.status} error={geo.error} />
                <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-white/90">
                  {photo.width} × {photo.height} · {formatBytes(photo.size)}
                </span>
              </div>
            </div>
            <div className="border-t border-white/10 bg-slate-900 px-5 py-5">
              <h1 className="text-lg font-semibold">Photo preview</h1>
              <p className="mt-1 text-sm text-slate-300">
                Retake if the damage is not clear. Nothing is uploaded until you confirm and submit.
              </p>
              {locationIssue ? (
                <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
                  <p className="text-sm font-medium text-amber-100">
                    Location access is required to submit a road-damage report.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={geo.capture}>
                    Enable location
                  </Button>
                </div>
              ) : null}
              <div className="mt-5 grid grid-cols-3 gap-3">
                <Button variant="outline" icon={<RotateCcw size={16} />} onClick={() => void retakePhoto()}>
                  Retake
                </Button>
                <Button className="col-span-2" icon={<Check size={17} />} disabled={!locationReady} onClick={confirmPhoto}>
                  Confirm photo
                </Button>
              </div>
              <Button variant="ghost" className="mt-2 w-full text-slate-300 hover:bg-white/10 hover:text-white" onClick={cancel}>
                Cancel
              </Button>
            </div>
          </main>
        ) : null}

        {stage === 'confirm' && photo && geo.location ? (
          <main className="flex flex-1 flex-col px-5 py-7 sm:px-10">
            <button type="button" onClick={() => setStage('preview')} className="mb-5 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
              <ArrowLeft size={16} /> Back to photo
            </button>
            <h1 className="text-2xl font-bold">Photo + Location + Report</h1>
            <p className="mt-2 text-sm text-slate-300">
              Review the evidence before submitting. AI will analyse the image and create a public report reference.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <img src={photo.previewUrl} alt="Confirmed road photo" className="h-52 w-full object-cover" />
                <div className="p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Fresh camera photo</p>
                  <p className="mt-1 text-sm text-slate-200">
                    {photo.width} × {photo.height} · {formatBytes(photo.size)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Captured {formatDateTime(photo.capturedAt)}</p>
                </div>
              </section>
              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Location</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-200">
                  <MapPin size={16} /> Approximate area {coarseArea(geo.location)}
                </p>
                <p className="mt-2 text-xs text-slate-300">GPS accuracy: {Math.round(geo.location.accuracy)} m</p>
                <p className="mt-1 text-xs text-slate-400">Captured {formatDateTime(geo.location.capturedAt)}</p>
                <div className="mt-5 rounded-xl bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">AI analysis</p>
                  <p className="mt-1 text-sm text-slate-200">Likely damage, confidence and estimated severity</p>
                  <p className="mt-1 text-xs text-slate-400">An official makes the final decision.</p>
                </div>
              </section>
            </div>

            {cameraIssue ? <Alert tone="danger" className="mt-5">{cameraIssue}</Alert> : null}
            {locationIssue ? (
              <Alert tone="warning" className="mt-5" title="Location access is required">
                {locationIssue} <Button size="sm" variant="outline" className="ml-2" onClick={geo.capture}>Enable location</Button>
              </Alert>
            ) : null}
            {submitError ? <Alert tone="danger" className="mt-5">{submitError}</Alert> : null}

            <div className="mt-auto pt-7">
              <PrivacyNotice />
              <Button
                size="lg"
                className="mt-4 w-full"
                icon={<ScanLine size={18} />}
                disabled={!locationReady}
                onClick={submitReport}
              >
                Submit road report
              </Button>
            </div>
          </main>
        ) : null}

        {stage === 'submitting' ? (
          <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
            <Spinner size="lg" label="Submitting report" />
            <h1 className="text-xl font-semibold">
              {uploadFraction < 1 ? 'Uploading fresh photo' : 'AI analysis is running'}
            </h1>
            <p className="max-w-sm text-sm text-slate-300">
              The existing computer-vision service is analysing the image. Results are never fabricated;
              DEMO MODE is shown if trained weights are unavailable.
            </p>
            <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-brand-400 transition-all"
                style={{ width: `${Math.max(8, Math.round(uploadFraction * 100))}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">{Math.round(uploadFraction * 100)}% uploaded</p>
          </main>
        ) : null}
      </div>
    </div>
  );
}
