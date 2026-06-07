import { AlertTriangle, Camera, Clock3, Database, MapPin, Radio } from 'lucide-react';
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

function ageMinutes(snapshotTime: number, timestamp: string) {
  return Math.max(0, Math.round((snapshotTime - new Date(timestamp).getTime()) / 60_000));
}

function severity(minutes: number): MapMarker['severity'] {
  if (minutes > 20) return 'high';
  if (minutes > 10) return 'medium';
  return 'low';
}

export default function GovInfrastructure() {
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
    severity: severity(camera.ageMinutes),
  }));
  const currentCameras = cameras.filter((camera) => camera.ageMinutes <= 10);
  const delayedCameras = cameras.filter((camera) => camera.ageMinutes > 10);
  const oldestAge = Math.max(...cameras.map((camera) => camera.ageMinutes), 0);
  const previewCameras = [...cameras].sort((a, b) => a.ageMinutes - b.ageMinutes).slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold">Infrastructure Monitoring</h1>
        <p className="text-zinc-400">Real LTA traffic-camera coverage and telemetry freshness</p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-900/60 bg-blue-950/20 p-4 text-sm">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
        <div>
          <div className="font-medium text-blue-300">Official infrastructure snapshot</div>
          <p className="mt-1 text-zinc-400">
            Dot colours measure camera-feed freshness at the snapshot time. They do not estimate congestion
            or road speed from the images.
          </p>
          <a
            className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300"
            href={infrastructure.source.url}
            target="_blank"
            rel="noreferrer"
          >
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
            <p className="mt-1 text-xs text-zinc-500">
              Snapshot time: {new Date(infrastructure.timestamp).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />0-10 min</span>
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-yellow-500" />11-20 min</span>
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-red-500" />20+ min</span>
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-zinc-500" />No camera</span>
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
              <img
                src={camera.image}
                alt={`LTA traffic camera ${camera.id}`}
                className="aspect-video w-full bg-zinc-950 object-cover"
                loading="lazy"
              />
              <div className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="font-medium">Camera {camera.id}</span>
                <span className="text-xs text-zinc-500">
                  {camera.ageMinutes === 0 ? 'Current' : `${camera.ageMinutes} min old`}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
