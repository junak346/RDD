import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  Cpu,
  Database,
  Layers,
  Map as MapIcon,
  Route,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Timer,
  Zap,
} from 'lucide-react';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useAuth } from '../stores/auth';

const DAMAGE_TYPES = [
  {
    name: 'Potholes',
    description: 'Compact surface holes and depressions — the most common cause of vehicle damage.',
    color: 'bg-red-500',
  },
  {
    name: 'Cracks',
    description: 'Longitudinal, transverse and alligator cracking across the pavement surface.',
    color: 'bg-amber-500',
  },
  {
    name: 'Surface damage',
    description: 'Ravelling, rutting and general surface deterioration before failure.',
    color: 'bg-violet-500',
  },
  {
    name: 'Other anomalies',
    description: 'Configurable classes — extend the model catalogue for local damage types.',
    color: 'bg-slate-500',
  },
];

const BENEFITS = [
  {
    icon: Timer,
    title: 'Faster than manual inspection',
    description: 'Analyse a road image in seconds instead of logging damage by hand.',
  },
  {
    icon: ShieldCheck,
    title: 'Consistent severity estimates',
    description: 'A transparent severity layer ranks damage the same way every time.',
  },
  {
    icon: Database,
    title: 'Everything is stored & searchable',
    description: 'Every analysis becomes a structured, filterable inspection record.',
  },
  {
    icon: BarChart3,
    title: 'Analytics that answer questions',
    description: 'Trends, distributions and top-affected areas computed from real data.',
  },
  {
    icon: MapIcon,
    title: 'Geographic monitoring',
    description: 'Located reports appear on an interactive map for maintenance planning.',
  },
  {
    icon: Cpu,
    title: 'Swappable AI engine',
    description: 'The model sits behind a clean interface — upgrade it without rewrites.',
  },
];

const TECH = [
  'React + TypeScript',
  'Tailwind CSS',
  'Node.js · Express',
  'MongoDB',
  'FastAPI · Python',
  'YOLO / PyTorch',
  'OpenCV',
  'Docker',
];

export function LandingPage() {
  const { user } = useAuth();
  const ctaTo = user ? '/app' : '/register';

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950">
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'url(/hero-road.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(100deg, rgb(15 23 42 / 0.96) 30%, rgb(15 23 42 / 0.55) 70%, rgb(15 23 42 / 0.35))',
          }}
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="max-w-2xl">
            <Badge tone="brand" className="bg-brand-500/15 text-brand-200 ring-brand-400/30">
              <Sparkles size={12} aria-hidden /> Computer-vision road monitoring
            </Badge>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              See road damage
              <span className="block text-brand-300">before it becomes a bigger problem.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              Upload a road image and let AI locate potholes, cracks and surface damage — with
              confidence scores, severity estimates, analytics and an interactive damage map in one
              professional platform.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to={ctaTo}>
                <Button size="lg" icon={<ScanLine size={18} />} className="gap-2">
                  Analyse a road image
                  <ArrowRight size={16} aria-hidden />
                </Button>
              </Link>
              <Link to={user ? '/app/analytics' : '/login'}>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-white/5 text-white hover:bg-white/10"
                >
                  {user ? 'View analytics' : 'Sign in to dashboard'}
                </Button>
              </Link>
            </div>
            <dl className="mt-12 grid grid-cols-3 gap-6 max-w-lg">
              {[
                ['Seconds', 'per image analysis'],
                ['3 signals', 'size · confidence · type'],
                ['100%', 'searchable history'],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-xl font-semibold text-white">{value}</dt>
                  <dd className="mt-1 text-xs text-slate-400">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* AI detection preview */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              AI detection preview
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              Every damage region located, labelled and scored
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              The analysis pipeline draws bounding boxes over detected damage, assigns a damage
              class, and reports a confidence score and estimated severity for each region — so
              reviewers can see exactly what the model saw.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Original and AI-annotated image comparison with zoom and pan',
                'Detection list with class, confidence, severity and coordinates',
                'Severity engine documented as an estimate — never an engineering verdict',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
                  <span className="text-sm text-slate-600">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <figure className="relative">
            <img
              src="/hero-road.jpg"
              alt="Road surface with potholes and cracks, illustrative AI detection overlay"
              className="w-full rounded-xl shadow-panel"
            />
            {/* Illustrative overlay boxes */}
            <svg
              aria-hidden
              viewBox="0 0 100 62"
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="none"
            >
              <rect x="14" y="34" width="19" height="13" fill="none" stroke="#ef4444" strokeWidth="0.7" />
              <rect x="52" y="26" width="22" height="9" fill="none" stroke="#f59e0b" strokeWidth="0.7" />
            </svg>
            <span className="absolute left-[14%] top-[48%] -translate-y-full rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">
              Pothole 92%
            </span>
            <span className="absolute left-[52%] top-[34%] -translate-y-full rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">
              Crack 81%
            </span>
            <figcaption className="mt-2 text-center text-xs text-slate-400">
              Illustrative preview — actual results depend on the installed model.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              From photo to maintenance insight in four steps
            </h2>
          </div>
          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Camera,
                title: 'Capture',
                text: 'Photograph the road surface with any phone or survey camera.',
              },
              {
                icon: Zap,
                title: 'Analyse',
                text: 'The AI service detects and classifies visible damage regions.',
              },
              {
                icon: Layers,
                title: 'Review',
                text: 'Inspect annotated results, confidence and severity estimates.',
              },
              {
                icon: Route,
                title: 'Act',
                text: 'Track trends on the dashboard and prioritise via the damage map.',
              },
            ].map((step, index) => (
              <li key={step.title} className="surface-card relative p-6">
                <span className="tabular absolute right-5 top-5 text-3xl font-semibold text-slate-100">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <step.icon size={19} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Damage types */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
              Supported damage types
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              Configurable classes for every road network
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Damage classes are configuration, not hard-coded limits. Start with potholes, cracks
              and surface damage — then extend the class catalogue as your trained model learns new
              categories.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {DAMAGE_TYPES.map((type) => (
                <div key={type.name} className="flex items-start gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${type.color}`} />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{type.name}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{type.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <figure>
            <img
              src="/damage-crack.jpg"
              alt="Close-up of cracked asphalt showing alligator cracking"
              className="w-full rounded-xl shadow-card"
            />
            <figcaption className="mt-2 text-center text-xs text-slate-400">
              Cracking patterns like these are classified and severity-ranked automatically.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Analytics + map preview */}
      <section className="bg-slate-950 py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-400">
              Analytics &amp; monitoring
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Turn individual detections into a monitoring programme
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              Dashboards, trends and maps are computed from your stored inspections — no vanity
              numbers, just the data your team has actually collected.
            </p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-8">
              <div className="flex items-center gap-2.5">
                <BarChart3 size={18} className="text-brand-400" />
                <h3 className="text-base font-semibold text-white">Analytics dashboard</h3>
              </div>
              <div className="mt-6 flex h-44 items-end gap-2.5">
                {[34, 52, 41, 68, 56, 82, 64, 91, 72, 60, 85, 95].map((height, index) => (
                  <div
                    key={index}
                    className="flex-1 rounded-t bg-gradient-to-t from-brand-600/70 to-brand-400"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              <ul className="mt-6 space-y-2 text-sm text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400" /> Damage type &amp; severity
                  distributions
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400" /> Inspections over time with
                  date-range filters
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400" /> Top affected areas by
                  recorded address
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-8">
              <div className="flex items-center gap-2.5">
                <MapIcon size={18} className="text-brand-400" />
                <h3 className="text-base font-semibold text-white">Damage map</h3>
              </div>
              <div className="relative mt-6 h-44 overflow-hidden rounded-lg bg-slate-900">
                <svg aria-hidden className="absolute inset-0 h-full w-full opacity-30">
                  <defs>
                    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                      <path d="M24 0H0v24" fill="none" stroke="#334155" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                  <path
                    d="M0 130 C 80 90, 160 150, 260 100 S 420 60, 520 110"
                    fill="none"
                    stroke="#3372f0"
                    strokeWidth="3"
                  />
                </svg>
                {[
                  { left: '18%', top: '58%', color: '#ef4444' },
                  { left: '42%', top: '38%', color: '#f59e0b' },
                  { left: '63%', top: '55%', color: '#22c55e' },
                  { left: '78%', top: '30%', color: '#ef4444' },
                ].map((marker) => (
                  <span
                    key={marker.left}
                    className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                    style={{ left: marker.left, top: marker.top, backgroundColor: marker.color }}
                  />
                ))}
              </div>
              <ul className="mt-6 space-y-2 text-sm text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400" /> Severity-coded markers with
                  inspection details
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400" /> Filter by damage type,
                  severity and date
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400" /> Location data always
                  optional for analysis
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
            Why RoadDamage AI
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            Built for teams who maintain real roads
          </h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="surface-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <benefit.icon size={19} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Technology */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto w-full max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Engineered with a modern stack
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {TECH.map((item) => (
              <span
                key={item}
                className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 shadow-sm"
              >
                {item}
              </span>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-xs leading-relaxed text-slate-400">
            AI results assist human judgement — confidence scores are model estimates and severity is
            a heuristic ranking, not a substitute for professional civil-engineering assessment.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-700">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Ready to see your roads clearly?
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-100">
              Create an account and run your first AI road analysis in under a minute.
            </p>
          </div>
          <Link to={ctaTo}>
            <Button size="lg" className="bg-white text-brand-700 hover:bg-brand-50">
              Get started free
              <ArrowRight size={16} aria-hidden />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
