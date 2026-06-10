import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle,
  Clock3,
  Database,
  MapPin,
  Radio,
  RefreshCw,
  Wifi,
  Zap,
} from 'lucide-react';
import { apiUrl, useApi } from '../../lib/api';
import { authHeaders } from '../../lib/auth';
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
  { id: 'traffic' as const, label: 'Traffic Network', severity: 'low', color: 'text-blue-400', badge: 'bg-blue-900 text-blue-400' },
  { id: 'network' as const, label: 'Utilities & Networks', severity: 'medium', color: 'text-yellow-400', badge: 'bg-yellow-900 text-yellow-400' },
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

function liveImageUrl(camera: CameraSnapshot) {
  const separator = camera.image.includes('?') ? '&' : '?';
  return `${camera.image}${separator}frame=${encodeURIComponent(camera.timestamp)}`;
}

function freshnessSeverity(minutes: number): MapMarker['severity'] {
  if (minutes > 20) return 'high';
  if (minutes > 10) return 'medium';
  return 'low';
}

function TrafficView() {
  const { data: dashboardData, loading, error } = useApi<CachedDashboardData>('/api/dashboard/cached-external');
  const [liveInfrastructure, setLiveInfrastructure] = useState<InfrastructureSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [cameraPage, setCameraPage] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const infrastructure = liveInfrastructure ?? dashboardData?.infrastructure;

  const refreshCameras = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);

    try {
      const response = await fetch(apiUrl('/api/gov/infrastructure/cameras/live'), {
        headers: authHeaders(),
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const payload = await response.json() as { infrastructure: InfrastructureSnapshot };
      setLiveInfrastructure(payload.infrastructure);
      setLiveError(null);
      setLastCheckedAt(new Date());
    } catch (caught) {
      setLiveError(caught instanceof Error ? caught.message : 'Live camera refresh failed');
    } finally {
      if (!quiet) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshCameras(true);
    const timer = window.setInterval(() => void refreshCameras(true), 20_000);
    return () => window.clearInterval(timer);
  }, [refreshCameras]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCameraPage((current) => current + 1);
    }, 8_000);
    return () => window.clearInterval(timer);
  }, []);

  if (loading) {
    return <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">Loading infrastructure dashboard...</div>;
  }

  if (error || !infrastructure) {
    return <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">Infrastructure dashboard API unavailable: {error ?? 'missing infrastructure data'}</div>;
  }

  const cameras = infrastructure.cameras.map((camera) => ({
    ...camera,
    ageMinutes: ageMinutes(clock, camera.timestamp),
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
  const sortedCameras = [...cameras].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const pageCount = Math.max(1, Math.ceil(sortedCameras.length / 6));
  const visiblePage = cameraPage % pageCount;
  const previewCameras = sortedCameras.slice(visiblePage * 6, visiblePage * 6 + 6);

  return (
    <>
      <div className="flex items-start gap-3 rounded-xl border border-blue-900/60 bg-blue-950/20 p-4 text-sm">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
        <div>
          <div className="font-medium text-blue-300">Official infrastructure snapshot</div>
          <p className="mt-1 text-zinc-400">
            Near-live still images update directly from the LTA traffic-camera feed every 20 seconds. Dot colours measure
            feed freshness and do not estimate congestion or road speed.
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
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Latest Camera Images</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Auto-refreshes every 20 seconds and rotates through all {cameras.length} cameras
              {liveError ? ` - using last available snapshot (${liveError})` : ''}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              </span>
              {liveError
                ? 'Live refresh interrupted'
                : `Live feed checked ${lastCheckedAt ? lastCheckedAt.toLocaleTimeString() : 'on load'}`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refreshCameras(false)}
            disabled={refreshing}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh now
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {previewCameras.map((camera) => (
            <article key={camera.id} className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/40">
              <img
                key={`${camera.id}-${camera.timestamp}`}
                src={liveImageUrl(camera)}
                alt={`LTA traffic camera ${camera.id}`}
                className="aspect-video w-full bg-zinc-950 object-cover"
                loading="eager"
              />
              <div className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="font-medium">Camera {camera.id}</span>
                <span className="text-xs text-zinc-500">{camera.ageMinutes === 0 ? 'Current' : `${camera.ageMinutes} min old`}</span>
              </div>
            </article>
          ))}
        </div>
        {pageCount > 1 ? (
          <div className="mt-4 flex items-center justify-center gap-2">
            {Array.from({ length: pageCount }, (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCameraPage(index)}
                className={`h-2 rounded-full transition-all ${
                  index === visiblePage ? 'w-6 bg-blue-500' : 'w-2 bg-zinc-700 hover:bg-zinc-500'
                }`}
                aria-label={`Show camera group ${index + 1}`}
              />
            ))}
          </div>
        ) : null}
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold">Infrastructure Monitoring</h1>
        <p className="text-zinc-400">Critical infrastructure health, resilience tracking, and live transport-camera coverage</p>
      </div>

      <div className="flex overflow-x-auto border-b border-zinc-800" role="tablist" aria-label="Infrastructure dashboards">
        {infrastructureViews.map((view) => (
          <button
            key={view.id}
            type="button"
            role="tab"
            aria-selected={selectedView === view.id}
            onClick={() => setSelectedView(view.id)}
            className={`flex min-w-max items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              selectedView === view.id
                ? `${view.color} border-current`
                : 'border-transparent text-zinc-500 hover:text-zinc-200'
            }`}
          >
            {view.label}
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${view.badge}`}>{view.severity.toUpperCase()}</span>
          </button>
        ))}
      </div>

      {selectedView === 'traffic' ? <TrafficView /> : <NetworkView />}
    </div>
  );
}
