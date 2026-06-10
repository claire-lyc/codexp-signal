import { Link } from 'react-router';
import {
  Shield,
  Users,
  Activity,
  Building2,
  CloudRain,
  HandHeart,
  Radio,
} from 'lucide-react';

const intelligenceStreams = [
  { label: 'Case & outbreak signals', detail: 'Covid-19, dengue, haze-linked health advisories', icon: Activity },
  { label: 'Healthcare capacity', detail: 'ICU load, bed pressure, clinics and nearby resources', icon: Building2 },
  { label: 'Weather & flood risk', detail: 'Rainfall alerts, regional heatmaps and infrastructure impact', icon: CloudRain },
  { label: 'Volunteer coordination', detail: 'Community responders, supply needs and public reports', icon: HandHeart },
];

const responseLoop = [
  'Gather live signals from agencies, public reports and operational datasets.',
  'Fuse them into one Singapore-wide operating picture for commanders and residents.',
  'Recommend next actions, broadcasts and resource deployments with human approval.',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-red-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative rounded-2xl border border-red-500/30 bg-red-600/10 p-2">
              <Shield className="h-7 w-7 text-red-500" strokeWidth={1.6} />
              <div className="absolute inset-0 rounded-2xl bg-red-600/20 blur-xl" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight"><span className="text-red-500">S</span>i<span className="text-red-500">G</span>nal</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/70 px-4 py-2 text-sm text-zinc-400 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Singapore crisis information hub
          </div>
        </header>

        <main className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr]">
          <section>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-sm font-medium text-zinc-300 shadow-sm">
              <Activity className="h-4 w-4 text-emerald-400" />
              Mission: faster, smarter disaster and health emergency response
            </div>

            <h1 className="max-w-4xl text-5xl font-bold leading-tight tracking-tight md:text-7xl">
              One command picture for <span className="text-red-500">every crisis signal</span>.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              SiGnal brings cases, hospital capacity, flood conditions, medicine supply, citizen reports and volunteer readiness into a single web application so Singapore can decide, alert and mobilise when minutes matter.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/login?portal=gov&redirect=%2Fgov"
                className="group inline-flex items-center justify-center gap-3 rounded-xl bg-red-600 px-6 py-4 font-semibold text-white shadow-2xl shadow-red-950/60 transition-all hover:-translate-y-0.5 hover:bg-red-500"
              >
                <Radio className="h-5 w-5" />
                Open Command Centre
              </Link>
              <Link
                to="/login?portal=public&redirect=%2Fpublic"
                className="inline-flex items-center justify-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/70 px-6 py-4 font-semibold text-zinc-100 transition-all hover:-translate-y-0.5 hover:border-white hover:bg-zinc-800"
              >
                <Users className="h-5 w-5" />
                Open Public Portal
              </Link>
            </div>

            <div className="mt-10 grid gap-3 text-sm text-zinc-300 md:grid-cols-3">
              {responseLoop.map((step, index) => (
                <div key={step} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-red-600/15 text-sm font-bold text-red-400">{index + 1}</div>
                  {step}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950/50 p-5 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Integrated crisis streams</h2>
                  <p className="text-sm text-zinc-500">Designed for the Quick Aid problem statement</p>
                </div>
                <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">Live-ready</div>
              </div>

              <div className="grid gap-3">
                {intelligenceStreams.map((stream) => {
                  const Icon = stream.icon;
                  return (
                    <div key={stream.label} className="group rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 transition-colors hover:border-red-700/70">
                      <div className="flex gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600/10 text-red-400">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-zinc-100">{stream.label}</h3>
                          <p className="mt-1 text-sm leading-6 text-zinc-400">{stream.detail}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="text-2xl font-bold text-white">5+</div>
                <div className="mt-1 text-xs text-zinc-500">source types</div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="text-2xl font-bold text-white">2</div>
                <div className="mt-1 text-xs text-zinc-500">user portals</div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="text-2xl font-bold text-white">24/7</div>
                <div className="mt-1 text-xs text-zinc-500">readiness</div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
