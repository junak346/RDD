import { Link } from 'react-router-dom';
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  LocateFixed,
  ScanLine,
  ShieldCheck,
} from 'lucide-react';

import { PublicLayout } from '../components/layout/PublicLayout';

const STEPS = [
  {
    icon: Camera,
    title: 'Capture a fresh photo',
    text: 'Open your device camera from the browser. No gallery upload, no account and no computer file picker.',
  },
  {
    icon: LocateFixed,
    title: 'Add current location',
    text: 'Explicitly share GPS so the report can be mapped. The public view only shows a coarse area.',
  },
  {
    icon: ScanLine,
    title: 'AI analyses the road',
    text: 'The existing computer-vision pipeline detects likely damage, confidence and an estimated severity.',
  },
  {
    icon: ClipboardCheck,
    title: 'Track the response',
    text: 'Use your unguessable report ID to follow a clear status timeline — without creating an account.',
  },
];

export function LandingPage() {
  return (
    <PublicLayout>
      <section className="relative overflow-hidden border-b border-slate-100 bg-slate-950">
        <img
          src="/hero-road.jpg"
          alt="A road surface photographed from a vehicle"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/40" aria-hidden />
        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-200">
              <ShieldCheck size={14} aria-hidden /> Citizen road reporting
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">
              See it. Capture it. Report it.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-200 sm:text-lg">
              Help identify road damage in your area. Capture a fresh photo, share its location, and
              let AI analyse the road condition.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/report"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-brand-500 px-6 text-base font-semibold text-white shadow-lg transition-colors hover:bg-brand-400"
              >
                <Camera size={19} aria-hidden /> Report road damage
              </Link>
              <Link
                to="/track"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/30 bg-white/10 px-6 text-base font-semibold text-white transition-colors hover:bg-white/20"
              >
                <ClipboardCheck size={18} aria-hidden /> Check report status
              </Link>
            </div>
            <p className="mt-5 flex max-w-xl gap-2 text-xs leading-relaxed text-slate-300">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden />
              Your camera image and location are collected to analyse and manage this road-damage
              report. Please avoid capturing unnecessary personal or sensitive information.
            </p>
          </div>

          <div className="mx-auto w-full max-w-sm rounded-3xl border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur">
            <div className="rounded-2xl bg-slate-900 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">RoadVision</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  <LocateFixed size={12} /> GPS ready
                </span>
              </div>
              <div className="mt-4 flex aspect-[3/4] items-center justify-center rounded-xl border border-white/10 bg-gradient-to-b from-slate-800 to-slate-950">
                <Camera size={52} className="text-brand-300" aria-hidden />
              </div>
              <div className="mt-4 flex items-center justify-center">
                <span className="h-14 w-14 rounded-full border-4 border-white bg-white/20" aria-hidden />
              </div>
              <p className="mt-4 text-center text-xs text-slate-400">One tap → camera → location → report</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Capture. Detect. Locate. Report. Resolve.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            AI can highlight likely damage, but government officials verify the evidence and decide
            priority, assignment and resolution.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div key={step.title} className="surface-card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <step.icon size={20} aria-hidden />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Step {index + 1}</p>
              <h3 className="mt-1 text-base font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Built for trust and privacy</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              Normal citizens do not need to register. Reports receive an unguessable public ID and
              a separate internal case record. Exact GPS and captured images are restricted to
              authorized officials; the public tracking page shows only limited status information.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              'No login for citizens',
              'Fresh camera photo only',
              'Explicit location permission',
              'Coarse public location',
              'Honest DEMO MODE labelling',
              'AI estimate ≠ official decision',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-14 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Ready to report a damaged road?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
          Use a modern mobile browser over HTTPS. Camera and location permission prompts appear only
          after you choose to continue.
        </p>
        <Link
          to="/report"
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-brand-600 px-7 text-base font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          <Camera size={18} aria-hidden /> Report road damage
        </Link>
      </section>
    </PublicLayout>
  );
}
