// GET /api/citizen/alerts
// GET /api/heatmap?layer=crises&public=true
import { AlertTriangle, MapPin, Activity, Shield, Navigation, CloudRain, Wind } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import SingaporeRegionMap, { type MapHeatmapLayer, type MapMarker } from '../SingaporeRegionMap';
import { apiUrl, useApi } from '../../lib/api';

type PublicHomeData = {
  activeCrisisLabels: string[];
  summary: string;
  stats: Array<{ label: string; value: string; icon: string; colour: string }>;
  activeAlerts: Array<{ id: number; type: string; message: string; severity: string; region: string }>;
  nearbyResources: Array<{ name: string; type: string; distance: string; status: string }>;
  updates: Array<{ time: string; message: string }>;
};

type LiveCitizenAlert = {
  id: number | string;
  title: string;
  message: string;
  crisis_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  region: string | null;
  status: 'active' | 'monitoring' | 'resolved';
  created_at: string;
};

type HomeAlert = {
  id: number | string;
  type: string;
  title?: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  region: string;
};

type BroadcastAlert = {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  target: string;
  status: 'ongoing' | 'resolved';
  time: string;
  updates?: { id: string; body: string; time: string; createdAt: string }[];
};

type CrisisCard = {
  id: string;
  title: string;
  type: string;
  value: string;
  detail: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  region: string;
  latitude: number;
  longitude: number;
  icon: 'activity' | 'rain' | 'wind' | 'shield';
};

const crisisIconMap = { activity: Activity, rain: CloudRain, wind: Wind, shield: Shield };
const broadcastSeverityStyles: Record<
  BroadcastAlert['severity'],
  { shell: string; rail: string; pill: string; icon: string; label: string }
> = {
  critical: {
    shell: 'border-red-800 bg-gradient-to-r from-red-950 via-zinc-950 to-zinc-900 shadow-[0_0_32px_rgba(220,38,38,0.18)]',
    rail: 'bg-red-600',
    pill: 'bg-red-600 text-white',
    icon: 'text-white',
    label: 'Critical',
  },
  high: {
    shell: 'border-orange-800 bg-gradient-to-r from-orange-950 via-zinc-950 to-zinc-900 shadow-[0_0_32px_rgba(249,115,22,0.16)]',
    rail: 'bg-orange-600',
    pill: 'bg-orange-600 text-white',
    icon: 'text-white',
    label: 'High',
  },
  medium: {
    shell: 'border-yellow-800 bg-gradient-to-r from-yellow-950/80 via-zinc-950 to-zinc-900 shadow-[0_0_28px_rgba(234,179,8,0.12)]',
    rail: 'bg-yellow-500',
    pill: 'bg-yellow-500 text-zinc-950',
    icon: 'text-zinc-950',
    label: 'Medium',
  },
  low: {
    shell: 'border-blue-800 bg-gradient-to-r from-blue-950/80 via-zinc-950 to-zinc-900 shadow-[0_0_28px_rgba(59,130,246,0.12)]',
    rail: 'bg-blue-600',
    pill: 'bg-blue-600 text-white',
    icon: 'text-white',
    label: 'Low',
  },
};
const regionCoordinates: Record<string, { latitude: number; longitude: number }> = {
  Nationwide: { latitude: 1.3521, longitude: 103.8198 },
  North: { latitude: 1.4291, longitude: 103.8354 },
  South: { latitude: 1.276, longitude: 103.8457 },
  East: { latitude: 1.3529, longitude: 103.9441 },
  West: { latitude: 1.3456, longitude: 103.7019 },
  Central: { latitude: 1.3021, longitude: 103.8398 },
  All: { latitude: 1.3521, longitude: 103.8198 },
};
const staticCrisisCards: CrisisCard[] = [
  {
    id: 'covid-watch',
    title: 'Covid-19 Watch',
    type: 'Health',
    value: '378 cases',
    detail: 'Respiratory infection activity is being monitored using the same health feed used by the government dashboard.',
    severity: 'medium',
    region: 'West',
    latitude: 1.3456,
    longitude: 103.7019,
    icon: 'activity',
  },
  {
    id: 'rainfall-risk',
    title: 'Elevated Flood Risk',
    type: 'Weather',
    value: '45mm peak',
    detail: 'Rainfall intensity is elevated in eastern and central areas. Avoid underpasses during heavy showers.',
    severity: 'high',
    region: 'East / Central',
    latitude: 1.3221,
    longitude: 103.8918,
    icon: 'rain',
  },
  {
    id: 'air-quality',
    title: 'Air Quality Advisory',
    type: 'Environment',
    value: 'PSI 76',
    detail: 'Air quality remains acceptable but sensitive groups should monitor symptoms during prolonged outdoor activity.',
    severity: 'low',
    region: 'Nationwide',
    latitude: 1.3521,
    longitude: 103.8198,
    icon: 'wind',
  },
];
const covidCaseMarkers: MapMarker[] = [
  { id: 'covid-bedok', name: 'Bedok', latitude: 1.324, longitude: 103.93, value: '64 active cases', detail: 'Moderate Covid-19 activity in eastern residential clusters.', severity: 'medium' },
  { id: 'covid-tampines', name: 'Tampines', latitude: 1.3547, longitude: 103.9436, value: '58 active cases', detail: 'Clinic visits for respiratory symptoms remain elevated.', severity: 'medium' },
  { id: 'covid-jurong', name: 'Jurong West', latitude: 1.3404, longitude: 103.7058, value: '76 active cases', detail: 'Highest current Covid-19 watch cluster in the public feed.', severity: 'high' },
  { id: 'covid-woodlands', name: 'Woodlands', latitude: 1.436, longitude: 103.786, value: '49 active cases', detail: 'Northern residential cases under monitoring.', severity: 'medium' },
  { id: 'covid-bishan', name: 'Bishan', latitude: 1.3508, longitude: 103.8485, value: '42 active cases', detail: 'Central area activity remains moderate.', severity: 'medium' },
  { id: 'covid-queenstown', name: 'Queenstown', latitude: 1.2942, longitude: 103.7861, value: '29 active cases', detail: 'Lower but visible Covid-19 activity.', severity: 'low' },
  { id: 'covid-punggol', name: 'Punggol', latitude: 1.3984, longitude: 103.9072, value: '36 active cases', detail: 'Monitoring newer residential clusters.', severity: 'low' },
];
const floodRiskLayer: MapHeatmapLayer = {
  label: 'Flood risk severity',
  unit: 'risk',
  palette: 'psi',
  min: 0,
  max: 100,
  opacity: 0.82,
  radius: 46,
  cellSize: 8,
  points: [
    { id: 'flood-orchard', name: 'Orchard underpass', latitude: 1.3048, longitude: 103.8318, value: 92 },
    { id: 'flood-east-coast', name: 'East Coast', latitude: 1.305, longitude: 103.912, value: 78 },
    { id: 'flood-bedok', name: 'Bedok', latitude: 1.324, longitude: 103.93, value: 68 },
    { id: 'flood-bishan', name: 'Bishan', latitude: 1.3508, longitude: 103.8485, value: 55 },
    { id: 'flood-jurong', name: 'Jurong West', latitude: 1.3404, longitude: 103.7058, value: 36 },
    { id: 'flood-woodlands', name: 'Woodlands', latitude: 1.436, longitude: 103.786, value: 28 },
  ],
};
const psiRiskLayer: MapHeatmapLayer = {
  label: 'Air quality PSI',
  unit: 'PSI',
  palette: 'psi',
  min: 30,
  max: 120,
  opacity: 0.8,
  radius: 52,
  cellSize: 8,
  points: [
    { id: 'psi-west', name: 'West', latitude: 1.357, longitude: 103.7, value: 84 },
    { id: 'psi-north', name: 'North', latitude: 1.418, longitude: 103.82, value: 76 },
    { id: 'psi-central', name: 'Central', latitude: 1.357, longitude: 103.82, value: 69 },
    { id: 'psi-east', name: 'East', latitude: 1.357, longitude: 103.94, value: 62 },
    { id: 'psi-south', name: 'South', latitude: 1.296, longitude: 103.82, value: 52 },
  ],
};

export default function PublicHome() {
  const { data: publicHome, loading, error } = useApi<PublicHomeData>('/api/citizen/home');
  const { data: citizenAlerts } = useApi<{ items: LiveCitizenAlert[] }>('/api/citizen/alerts');
  const [broadcasts, setBroadcasts] = useState<BroadcastAlert[]>([]);
  const [selectedCrisisId, setSelectedCrisisId] = useState<string | null>(null);
  const situationMapRef = useRef<HTMLDivElement | null>(null);
  const liveAlerts = (citizenAlerts?.items ?? [])
    .filter((alert) => alert.status !== 'resolved')
    .map(mapLiveAlertToHomeAlert);
  const liveBroadcasts = broadcasts
    .filter((broadcast) => broadcast.status === 'ongoing')
    .map(mapBroadcastToHomeAlert);
  const activeAlerts = [...liveBroadcasts, ...liveAlerts];
  const visibleAlerts = activeAlerts.length ? activeAlerts : (publicHome?.activeAlerts ?? []);
  const nearbyResources = publicHome?.nearbyResources ?? [];
  const primaryBroadcast = broadcasts.find((broadcast) => broadcast.status === 'ongoing') ?? null;
  const broadcastStyle = primaryBroadcast ? broadcastSeverityStyles[primaryBroadcast.severity] : broadcastSeverityStyles.low;
  const selectedCrisis = staticCrisisCards.find((card) => card.id === selectedCrisisId) ?? null;
  const selectedHeatmapLayer = selectedCrisisId === 'rainfall-risk'
    ? floodRiskLayer
    : selectedCrisisId === 'air-quality'
      ? psiRiskLayer
      : undefined;
  const overallSituation = visibleAlerts.some((alert) => alert.severity === 'critical' || alert.severity === 'high') || staticCrisisCards.some((card) => card.severity === 'high')
    ? 'Elevated'
    : 'Stable';
  const mapMarkers = useMemo<MapMarker[]>(() => {
    if (!selectedCrisisId) return [];
    if (selectedCrisisId === 'covid-watch') return covidCaseMarkers;
    if (selectedHeatmapLayer) return [];

    const crisisMarkers = (selectedCrisis ? [selectedCrisis] : []).map((card) => ({
      id: card.id,
      name: card.region,
      latitude: card.latitude,
      longitude: card.longitude,
      value: `${card.type} - ${card.value}`,
      detail: `${card.title}. ${card.detail}`,
      severity: card.severity === 'critical' || card.severity === 'high' ? 'high' as const : card.severity === 'medium' ? 'medium' as const : 'low' as const,
    }));

    if (selectedCrisis) return crisisMarkers;

    return crisisMarkers;
  }, [selectedCrisis, selectedCrisisId, selectedHeatmapLayer, visibleAlerts]);

  useEffect(() => {
    fetch(apiUrl('/api/citizen/broadcasts'))
      .then((response) => {
        if (!response.ok) throw new Error('Broadcasts unavailable');
        return response.json() as Promise<{ items: BroadcastAlert[] }>;
      })
      .then((data) => setBroadcasts(data.items))
      .catch(() => setBroadcasts([]));
  }, []);

  useEffect(() => {
    const resetSituationFocus = (event: MouseEvent) => {
      if (!selectedCrisisId) return;
      const target = event.target as Node;
      if (situationMapRef.current && !situationMapRef.current.contains(target)) {
        setSelectedCrisisId(null);
      }
    };

    document.addEventListener('mousedown', resetSituationFocus);
    return () => document.removeEventListener('mousedown', resetSituationFocus);
  }, [selectedCrisisId]);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${broadcastStyle.pill}`}>
            Emergency Broadcast
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${broadcastStyle.pill}`}>
            {broadcastStyle.label} severity
          </span>
        </div>
        <div data-tour="alert-bar" className={`overflow-hidden rounded-xl border ${broadcastStyle.shell}`}>
        <div className="flex items-stretch">
          <div className={`flex items-center px-4 ${broadcastStyle.rail}`}>
            <AlertTriangle className={`h-6 w-6 ${broadcastStyle.icon}`} />
          </div>
          <div className="flex flex-1 flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-zinc-100">
                {liveBroadcasts.length
                  ? liveBroadcasts[0].title ?? liveBroadcasts[0].type
                  : 'No active government broadcasts'}
              </div>
              <div className="line-clamp-1 text-xs text-zinc-400">
                {liveBroadcasts.length ? liveBroadcasts[0].message : 'Official emergency broadcasts will appear here when active.'}
              </div>
              {Boolean(primaryBroadcast?.updates?.length) && (
                <div className="mt-2 space-y-1 border-l border-red-700/60 pl-3">
                  {primaryBroadcast.updates!.slice(-2).map((update) => (
                    <div key={update.id} className="text-xs text-zinc-300">
                      <span className="text-zinc-500">{update.time}</span> · {update.body}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {liveBroadcasts.length > 1 && (
                <span className="rounded-full border border-zinc-700 bg-zinc-950/70 px-3 py-1 text-xs text-zinc-300">
                  +{liveBroadcasts.length - 1} more
                </span>
              )}
              <Link data-tour="view-alerts" to="/public/alerts" className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 transition-colors hover:bg-white">
                View Alerts
              </Link>
            </div>
          </div>
        </div>
        </div>
      </div>

      {loading && <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">Loading public dashboard data...</div>}
      {error && <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">Public dashboard API unavailable: {error}</div>}

      <div ref={situationMapRef} className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Active Situations</h2>
            <div className={`rounded-full border px-3 py-1 text-xs font-medium ${overallSituation === 'Elevated' ? 'border-yellow-700 bg-yellow-950/40 text-yellow-300' : 'border-green-800 bg-green-950/40 text-green-300'}`}>
              {overallSituation}
            </div>
          </div>

          <div className="space-y-2">
            {staticCrisisCards.map((card) => {
              const Icon = crisisIconMap[card.icon];
              const active = selectedCrisisId === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  data-tour={card.id === staticCrisisCards[0].id ? 'first-situation' : undefined}
                  onClick={() => setSelectedCrisisId((current) => current === card.id ? null : card.id)}
                  className={`w-full rounded-lg border bg-zinc-950/40 p-3 text-left transition-colors hover:bg-zinc-800/80 ${active ? 'border-red-600 ring-1 ring-red-600/60' : 'border-zinc-800'}`}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="rounded-md bg-zinc-800 p-1.5">
                        <Icon className="h-4 w-4 text-red-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{card.title}</div>
                        <div className="text-xs text-zinc-500">{card.type}</div>
                      </div>
                    </div>
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${card.severity === 'high' ? 'bg-red-950 text-red-300' : card.severity === 'medium' ? 'bg-yellow-950 text-yellow-300' : 'bg-blue-950 text-blue-300'}`}>
                      {card.severity}
                    </span>
                  </div>
                  <div className="text-lg font-bold">{card.value}</div>
                  <p className={`mt-1 text-xs leading-relaxed text-zinc-400 ${active ? '' : 'line-clamp-2'}`}>{card.detail}</p>
                  <div className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
                    <MapPin className="h-3 w-3" />
                    {card.region}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section data-tour="situation-map" className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-600" />
              Location Map
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {selectedCrisisId === 'covid-watch' && (
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500" />High Risk</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-500" />Moderate</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500" />Low Risk</span>
                </div>
              )}
            </div>
          </div>
          <div className="h-[430px]">
            {selectedCrisisId ? (
              <SingaporeRegionMap
                markers={mapMarkers}
                heatmapLayer={selectedHeatmapLayer}
                showMarkers={!selectedHeatmapLayer}
                problemLabel={selectedHeatmapLayer ? selectedHeatmapLayer.label.toLowerCase() : selectedCrisisId === 'covid-watch' ? 'Covid-19 case clusters' : 'active signals'}
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 p-6 text-center">
                <div className="max-w-sm">
                  <MapPin className="mx-auto mb-4 h-9 w-9 text-zinc-600" />
                  <div className="text-lg font-semibold text-zinc-200">Select an active situation</div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Click an active situation to open its map layer and view the affected areas.
                  </p>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            {selectedCrisis ? `Showing ${selectedCrisis.title} on the map. Click outside this section or click the card again to reset.` : 'Select an active situation to display its static map layer.'}
          </p>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Nearby resources */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Nearby Resources
            </h2>
            <div className="space-y-3">
              {nearbyResources.map((resource, idx) => (
                <div key={idx} className="p-3 bg-zinc-800 rounded-lg">
                  <div className="flex items-start justify-between mb-1">
                    <div className="font-medium text-sm">{resource.name}</div>
                    <span className="text-xs px-2 py-0.5 bg-green-950 text-green-400 rounded">{resource.status}</span>
                  </div>
                  <div className="text-xs text-zinc-400 mb-2">{resource.type}</div>
                  <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <Navigation className="w-3 h-3" />{resource.distance}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          {/* Emergency actions */}
          <div className="bg-gradient-to-br from-red-950/50 to-orange-950/50 border border-red-900/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <Link to="/public/report" className="block w-full px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-center font-medium text-sm">
                Report an Issue
              </Link>
              <Link to="/public/volunteer" className="block w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-center font-medium text-sm">
                Volunteer to Help
              </Link>
              <a href="tel:995" className="block w-full px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-center font-medium text-sm">
                Emergency: Call 995
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-950/30 border border-blue-800 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
          <div className="text-sm text-zinc-300">
            <strong className="text-blue-400">Verified Information:</strong> All data on this platform is sourced from official government agencies and verified before publication. For urgent assistance, call <strong className="text-red-400">995</strong> (Emergency) or <strong className="text-blue-400">1777</strong> (Non-Emergency).
          </div>
        </div>
      </div>
    </div>
  );
}

function mapLiveAlertToHomeAlert(alert: LiveCitizenAlert): HomeAlert {
  return {
    id: alert.id,
    title: alert.title,
    type: formatCrisisType(alert.crisis_type),
    message: alert.message,
    severity: alert.severity,
    region: alert.region ?? 'Nationwide',
  };
}

function formatCrisisType(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function mapBroadcastToHomeAlert(broadcast: BroadcastAlert): HomeAlert {
  return {
    id: `broadcast-${broadcast.id}`,
    title: broadcast.title,
    type: 'Broadcast',
    message: broadcast.message,
    severity: broadcast.severity,
    region: broadcast.target || 'Nationwide',
  };
}
