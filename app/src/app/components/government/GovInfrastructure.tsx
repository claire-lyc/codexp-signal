import { useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle,
  ChevronDown,
  Clock3,
  Database,
  MapPin,
  Radio,
  Wifi,
  Zap,
} from 'lucide-react';
import { useApi } from '../../lib/api';
import SingaporeRegionMap, { type MapMarker } from '../SingaporeRegionMap';

type CameraSnapshot = {
  id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  image: string;
  width: number;
  height: number;
};

type InfrastructureSnapshot = {
  timestamp: string;
  cameras: CameraSnapshot[];
  source: {
    label: string;
    url: string;
  };
};

type CachedDashboardData = {
  infrastructure: InfrastructureSnapshot;
};

type InfrastructureViewId = 'traffic' | 'network';

const infrastructureViews = [
  { id: 'traffic' as const, label: 'Traffic Monitoring Network', severity: 'low', badge: 'bg-blue-900 text-blue-400', border: 'border-blue-700' },
  { id: 'network' as const, label: 'Network Information', severity: 'medium', badge: 'bg-yellow-900 text-yellow-400', border: 'border-yellow-700' },
];

const infrastructureStatus = [
  { name: 'Power Grid - North', status: 'operational', detail: 'Load: 78%' },
  { name: 'Power Grid - South', status: 'operational', detail: 'Load: 84%' },
  { name: 'Power Grid - East', status: 'warning', detail: 'Load: 92%' },
  { name: 'Power Grid - West', status: 'operational', detail: 'Load: 76%' },
  { name: 'Telecom Network - 5G', status: 'operational', detail: 'Uptime: 99.8%' },
  { name: 'Telecom Network - 4G', status: 'operational', detail: 'Uptime: 99.9%' },
  { name: 'Internet Exchange', status: 'operational', detail: 'Latency: 12ms' },
  { name: 'Public Transport System', status: 'operational', detail: 'Disruptions: 0' },
];

function ageMinutes(snapshotTime: number, timestamp: string) {
  return Math.max(0, Math.round((snapshotTime - new Date(timestamp).getTime()) / 60_000));
}

function freshnessSeverity(minutes: number): MapMarker['severity'] {
  if (minutes > 20) return 'high';
  if (minutes > 10) return 'medium';
  return 'low';
}

function TrafficView() {
  const { data: dashboardData, loading, error } = useApi<CachedDashboardData>('/api/dashboard/cached-external');
  const infrastructure = dashboardData?.infrastructure;

  if (loading) {
    return <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">Loading infrastructure dashboard...</div>;
  }

  if (error || !infrastructure) {
    return <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">Infrastructure dashboard API unavailable: {error ?? 'missing infrastructure data'}</div>;
  }

  const snapshotTime = new Date(infrastructure.timestamp).getTime();
  const cameras = infrastructure.cameras.map((camera) => ({
    ...camera,
    ageMinutes: ageMinutes(snapshotTime, camera.timestamp),
  }));
  const markers: MapMarker[] = cameras.map((camera) => ({
    id: `camera-${camera.id}`,
    name: `Traffic camera ${camera.id}`,
    latitude: camera.latitude,
    longitude: camera.longitude,
    value: camera.ageMinutes === 0 ? 'Current' : `${camera.ageMinutes} min old`,
    detail: `${camera.width} x ${camera.height} LTA traffic image captured ${new Date(camera.timestamp).toLocaleString()}`,
    severity: freshnessSeverity(camera.ageMinutes),
  }));
  const currentCameras = cameras.filter((camera) => camera.ageMinutes <= 10);
  const delayedCameras = cameras.filter((camera) => camera.ageMinutes > 10);
  const oldestAge = Math.max(...cameras.map((camera) => camera.ageMinutes), 0);
  const previewCameras = [...cameras].sort((a, b) => a.ageMinutes - b.ageMinutes).slice(0, 6);

  return (
    <>
      <div className="flex items-start gap-3 rounded-xl border border-blue-900/60 bg-blue-950/20 p-4 text-sm">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
        <div>
          <div className="font-medium text-blue-300">Official infrastructure snapshot</div>
          <p className="mt-1 text-zinc-400">
            Dot colours measure camera-feed freshness at the snapshot time. They do not estimate congestion
            or road speed from the images.
          </p>
          <a className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300" href={infrastructure.source.url} target="_blank" rel="noreferrer">
            {infrastructure.source.label}
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Reporting cameras', value: cameras.length, icon: Camera, colour: 'text-blue-400' },
          { label: 'Current within 10 min', value: currentCameras.length, icon: Radio, colour: 'text-green-400' },
          { label: 'Delayed feeds', value: delayedCameras.length, icon: AlertTriangle, colour: 'text-yellow-400' },
          { label: 'Oldest camera image', value: `${oldestAge} min`, icon: Clock3, colour: 'text-zinc-300' },
        ].map(({ label, value, icon: Icon, colour }) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <Icon className={`mb-3 h-5 w-5 ${colour}`} />
            <div className="text-2xl font-bold">{value}</div>
            <div className="mt-1 text-sm text-zinc-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <MapPin className="h-5 w-5 text-blue-500" />
              Traffic Monitoring Network
            </h2>
            <p className="mt-1 text-xs text-zinc-500">Snapshot time: {new Date(infrastructure.timestamp).toLocaleString()}</p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />0-10 min</span>
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-yellow-500" />11-20 min</span>
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-red-500" />20+ min</span>
          </div>
        </div>
        <div className="h-[520px]">
          <SingaporeRegionMap
            markers={markers}
            emptyTitle="LTA traffic camera network"
            emptyDetail="Hover a camera or planning area to inspect feed freshness"
            problemLabel="traffic camera feeds"
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Latest Camera Images</h2>
          <p className="mt-1 text-xs text-zinc-500">Most recent images in the cached data.gov.sg snapshot</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {previewCameras.map((camera) => (
            <article key={camera.id} className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/40">
              <img src={camera.image} alt={`LTA traffic camera ${camera.id}`} className="aspect-video w-full bg-zinc-950 object-cover" loading="lazy" />
              <div className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="font-medium">Camera {camera.id}</span>
                <span className="text-xs text-zinc-500">{camera.ageMinutes === 0 ? 'Current' : `${camera.ageMinutes} min old`}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}

function NetworkView() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="rounded-lg bg-green-950 p-2">
              <Zap className="h-5 w-5 text-green-500" />
            </div>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <div className="mb-1 text-2xl font-bold">99.2%</div>
          <div className="text-sm text-zinc-400">Power Grid Uptime</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="rounded-lg bg-blue-950 p-2">
              <Wifi className="h-5 w-5 text-blue-500" />
            </div>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <div className="mb-1 text-2xl font-bold">99.8%</div>
          <div className="text-sm text-zinc-400">Network Availability</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="rounded-lg bg-yellow-950 p-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <span className="rounded bg-yellow-950 px-2 py-1 text-xs text-yellow-400">Monitor</span>
          </div>
          <div className="mb-1 text-2xl font-bold">92%</div>
          <div className="text-sm text-zinc-400">Peak Grid Load (East)</div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="rounded-lg bg-green-950 p-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <div className="mb-1 text-2xl font-bold">0</div>
          <div className="text-sm text-zinc-400">Active Disruptions</div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 text-lg font-semibold">Infrastructure Status</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {infrastructureStatus.map((item) => (
            <div
              key={item.name}
              className={`rounded-lg border p-4 ${
                item.status === 'operational' ? 'border-green-800/50 bg-green-950/20' : 'border-yellow-800/50 bg-yellow-950/20'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{item.name}</span>
                {item.status === 'operational' ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              </div>
              <div className="text-sm text-zinc-400">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-yellow-800 bg-yellow-950/30 p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="mt-1 h-6 w-6 text-yellow-500" />
          <div>
            <h3 className="mb-2 font-semibold">East Region Power Grid Warning</h3>
            <p className="text-sm text-zinc-300">
              Power grid load in the eastern region is approaching a critical threshold. Recommend load balancing and backup generator readiness.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function GovInfrastructure() {
  const [selectedView, setSelectedView] = useState<InfrastructureViewId>('traffic');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const currentView = infrastructureViews.find((view) => view.id === selectedView)!;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Infrastructure Monitoring</h1>
          <p className="text-zinc-400">Critical infrastructure health, resilience tracking, and live transport-camera coverage</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((open) => !open)}
            className={`flex items-center gap-2 rounded-lg border ${currentView.border} bg-zinc-800 px-4 py-2 text-sm transition-colors hover:bg-zinc-700`}
          >
            <span className="text-white">{currentView.label}</span>
            <span className={`rounded px-1.5 py-0.5 text-xs ${currentView.badge}`}>{currentView.severity.toUpperCase()}</span>
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          </button>
          {dropdownOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl">
              {infrastructureViews.map((view) => (
                <button
                  key={view.id}
                  onClick={() => {
                    setSelectedView(view.id);
                    setDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-zinc-700 ${selectedView === view.id ? 'bg-zinc-700' : ''}`}
                >
                  <span>{view.label}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${view.badge}`}>{view.severity.toUpperCase()}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {selectedView === 'traffic' ? <TrafficView /> : <NetworkView />}
    </div>
  );
}
