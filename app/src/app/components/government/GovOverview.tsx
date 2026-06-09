// GET /api/crises?status=active
// GET /api/alerts?status=active&type=&region=
// GET /api/heatmap?crisisId=&layer=
import { useMemo, useRef, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, MapPin, Activity, Cloud, Package, Shield, ChevronRight, Filter, Pin } from 'lucide-react';
import { Link } from 'react-router';
import SingaporeRegionMap, { type MapMarker } from '../SingaporeRegionMap';
import { useApi } from '../../lib/api';

const iconMap = { Activity, Cloud, Package, Shield };
type CrisisCard = {
  id: string;
  label: string;
  type: string;
  severity: string;
  path: string;
  stats: Array<{ label: string; value: string; delta?: string }>;
  icon: string;
};
type OverviewData = {
  crises: unknown[];
  alerts: typeof alerts;
  overview: {
    crisisCards: CrisisCard[];
    incidentTrend: Array<{ date: string; incidents: number }>;
    riskSummary: { body: string; confidence: number; sources: string };
  };
};

const severityBadge: Record<string, string> = {
  high: 'bg-red-500/15 text-red-300 border-red-500/40',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  low: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
};
const severitySpark: Record<string, string> = {
  high: '#fb7185',
  medium: '#fbbf24',
  low: '#38bdf8',
};

const fallbackCrisisCards: CrisisCard[] = [
  {
    id: 'covid',
    label: 'Covid-19',
    type: 'Health',
    severity: 'medium',
    path: '/gov/pandemic',
    stats: [
      { label: 'Active cases today', value: '378', delta: '+12%' },
      { label: 'ICU occupancy', value: '25', delta: '+5' },
    ],
    icon: 'Activity',
  },
  {
    id: 'dengue',
    label: 'Dengue',
    type: 'Health',
    severity: 'high',
    path: '/gov/pandemic',
    stats: [
      { label: 'Red zone clusters', value: '14', delta: '+3' },
      { label: 'Cases this week', value: '212', delta: '+8%' },
    ],
    icon: 'Activity',
  },
  {
    id: 'flood',
    label: 'Flash Flood Risk',
    type: 'Weather',
    severity: 'high',
    path: '/gov/weather',
    stats: [
      { label: 'High-risk zones', value: '6', delta: '' },
      { label: 'Peak rainfall (1h)', value: '45mm', delta: 'Alert' },
    ],
    icon: 'Cloud',
  },
  {
    id: 'panadol',
    label: 'Panadol Shortage',
    type: 'Supply Chain',
    severity: 'medium',
    path: '/gov/supply-chain',
    stats: [
      { label: 'Affected outlets', value: '87', delta: '' },
      { label: 'Est. restock', value: '4 days', delta: '' },
    ],
    icon: 'Package',
  },
  {
    id: 'cyber',
    label: 'Cyber Incident',
    type: 'Cybersecurity',
    severity: 'low',
    path: '/gov/cybersecurity',
    stats: [{ label: 'Active threats', value: '3', delta: '-1' }],
    icon: 'Shield',
  },
];

const alerts: Array<{ id: number | string; type: string; severity: string; message: string; region: string; time?: string }> = [];
const trendData: Array<{ date: string; incidents: number }> = [];

const filterTypes = ['All', 'Health', 'Weather', 'Supply', 'Infrastructure', 'Cybersecurity'];
const filterSeverities = ['All', 'High', 'Medium', 'Low'];
const filterRegions = ['All', 'North', 'South', 'East', 'West', 'Central', 'Nationwide'];
const regionCoordinates: Record<string, { latitude: number; longitude: number }> = {
  Nationwide: { latitude: 1.3521, longitude: 103.8198 },
  North: { latitude: 1.4291, longitude: 103.8354 },
  South: { latitude: 1.276, longitude: 103.8457 },
  East: { latitude: 1.3529, longitude: 103.9441 },
  West: { latitude: 1.3456, longitude: 103.7019 },
  Central: { latitude: 1.3021, longitude: 103.8398 },
};

export default function GovOverview() {
  const { data, loading, error } = useApi<OverviewData>('/api/gov/overview');
  const [filterType, setFilterType] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterRegion, setFilterRegion] = useState('All');
  const [selectedAlertId, setSelectedAlertId] = useState<string | number | null>(null);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  const apiCrisisCards = data?.overview?.crisisCards ?? [];
  const crisisCards: CrisisCard[] = apiCrisisCards.length > 0 ? apiCrisisCards : fallbackCrisisCards;
  const alerts = data?.alerts ?? [];
  const trendData = data?.overview?.incidentTrend ?? [];
  const riskSummary = data?.overview?.riskSummary;

  const filteredAlerts = alerts.filter((a) => {
    const typeMatch = filterType === 'All' || a.type === filterType;
    const sevMatch = filterSeverity === 'All' || a.severity === filterSeverity.toLowerCase();
    const regMatch = filterRegion === 'All' || a.region.includes(filterRegion);
    return typeMatch && sevMatch && regMatch;
  });

  const mapMarkers = useMemo<MapMarker[]>(() => {
    const baseAlerts = selectedAlertId ? filteredAlerts.filter((alert) => alert.id === selectedAlertId) : filteredAlerts;
    return baseAlerts.map((alert) => {
      const regionName = filterRegions.find((region) => alert.region?.includes(region) && region !== 'All') ?? 'Nationwide';
      const coordinates = regionCoordinates[regionName] ?? regionCoordinates.Nationwide;
      return {
        id: String(alert.id),
        name: alert.region || 'Nationwide',
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        value: alert.severity.toUpperCase(),
        detail: alert.message,
        severity: alert.severity as 'high' | 'medium' | 'low',
      };
    });
  }, [filteredAlerts, selectedAlertId]);

  const focusAlertOnMap = (alert: (typeof filteredAlerts)[number]) => {
    setSelectedAlertId(alert.id);
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">National Crisis Command Centre</h1>
        <p className="text-zinc-400">Real-time overview of Singapore's crisis response systems</p>
      </div>

      {loading && <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">Loading dashboard data...</div>}
      {error && <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">Dashboard API unavailable: {error}</div>}

      {/* Horizontally scrollable crisis cards — GET /api/crises?status=active */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Active Crisis Situations</h2>
          <span className="text-xs text-zinc-600">Scroll to see all →</span>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
          {crisisCards.length === 0 && (
            <div className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">
              No active crisis situations available.
            </div>
          )}
          {crisisCards.map((card) => {
            const Icon = iconMap[card.icon as keyof typeof iconMap] ?? AlertCircle;
            const stats = Array.isArray(card.stats) ? card.stats : [];
            const primaryStat = stats[0];
            const secondaryStat = stats[1];
            return (
              <Link
                key={card.id}
                to={card.path}
                className="group relative flex-shrink-0 w-80 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-zinc-700 hover:bg-zinc-800/80"
              >
                <div className="absolute inset-x-0 bottom-0 h-px bg-zinc-700/60" />
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-xs text-zinc-500">
                    <Icon className="h-4 w-4 flex-shrink-0 text-zinc-500" />
                    <span className="truncate">{card.type}</span>
                    <ChevronRight className="h-3 w-3 text-zinc-600 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityBadge[card.severity]}`}>
                    {card.severity}
                  </span>
                </div>

                <div className="grid grid-cols-[0.9fr_1.1fr] items-center gap-4">
                  <div className="min-w-0">
                    <div className="mb-3 truncate text-sm font-semibold text-zinc-100">{card.label}</div>
                    <div className="text-3xl font-bold tracking-tight text-zinc-50">{primaryStat?.value ?? '--'}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                      <span className="truncate">{primaryStat?.label ?? 'Current metric'}</span>
                      {primaryStat?.delta && <span className="text-zinc-400">{primaryStat.delta}</span>}
                    </div>
                    {secondaryStat && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                        <span className="truncate">{secondaryStat.label}</span>
                        <span className="font-semibold text-zinc-200">{secondaryStat.value}</span>
                        {secondaryStat.delta && <span>{secondaryStat.delta}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 items-center rounded-lg bg-zinc-950/35 px-2 py-1">
                    <MiniTrend color={severitySpark[card.severity] ?? '#34d399'} seed={String(card.id)} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Heatmap + Active Alerts — GET /api/heatmap?layer=crises & GET /api/alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div ref={mapSectionRef} className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-600" />
              National Crisis Heatmap
            </h2>
            <span className="text-xs text-zinc-500">Pins linked to Active Alerts</span>
          </div>
          <div className="h-[440px]">
            <SingaporeRegionMap markers={mapMarkers} />
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500" />High Risk</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-yellow-500" />Medium Risk</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500" />Low Risk</div>
          </div>

          {/* Trend chart */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Active Incident Trend (7 days)</h3>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="incidentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 11 }} />
                <YAxis stroke="#71717a" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="incidents" stroke="#dc2626" fill="url(#incidentGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Active Alerts</h2>
            <Filter className="w-4 h-4 text-zinc-500" />
          </div>

          {/* Filters */}
          <div className="space-y-2 mb-4">
            <div className="flex gap-1 flex-wrap">
              {filterTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${filterType === t ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {filterSeverities.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterSeverity(s)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${filterSeverity === s ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {filterRegions.map((r) => (
                <button
                  key={r}
                  onClick={() => setFilterRegion(r)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${filterRegion === r ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto">
            {filteredAlerts.length === 0 && (
              <div className="text-center py-8 text-zinc-600 text-sm">No alerts match filters</div>
            )}
            {filteredAlerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => focusAlertOnMap(alert)}
                className={`p-3 rounded-lg border ${
                  alert.severity === 'high'
                    ? 'bg-red-950/30 border-red-800'
                    : alert.severity === 'medium'
                    ? 'bg-yellow-950/30 border-yellow-800'
                    : 'bg-blue-950/30 border-blue-800'
                } ${selectedAlertId === alert.id ? 'ring-1 ring-white/60' : ''} w-full text-left transition-colors hover:bg-zinc-800/60`}
              >
                <div className="flex items-start gap-2">
                  <AlertCircle
                    className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      alert.severity === 'high' ? 'text-red-500' : alert.severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium text-zinc-400">{alert.type}</span>
                      <span className="text-xs text-zinc-600">{alert.time}</span>
                    </div>
                    <div className="text-sm mb-1 leading-snug">{alert.message}</div>
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                      <MapPin className="w-3 h-3" />
                      <span>{alert.region}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data Projections summary */}
      <div className="bg-gradient-to-r from-blue-950/50 to-purple-950/50 border border-blue-900/50 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-900/50 rounded-lg">
            <Pin className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Analyst-Supported Risk Summary</h3>
            <p className="text-sm text-zinc-300 mb-3">
              {riskSummary?.body ?? 'No risk summary available.'}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="px-2 py-1 bg-zinc-800 rounded">Confidence: {riskSummary?.confidence ?? 0}%</span>
              <span className="px-2 py-1 bg-zinc-800 rounded">Sources: {riskSummary?.sources ?? 'None'}</span>
              <span className="px-2 py-1 bg-yellow-900 text-yellow-400 rounded">Human Approval Required</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniTrend({ color, seed }: { color: string; seed: string }) {
  const points = useMemo(() => buildSparkline(seed), [seed]);
  const gradientId = `trend-${seed.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  return (
    <svg viewBox="0 0 150 54" className="h-16 w-full overflow-visible" role="img" aria-label="Illustrative crisis trend">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${points} 150,54 0,54`} fill={`url(#${gradientId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" opacity="1" />
    </svg>
  );
}

function buildSparkline(seed: string) {
  const values = Array.from({ length: 28 }, (_, index) => {
    const code = seed.charCodeAt(index % seed.length) || 42;
    const wave = Math.sin(index * 0.82 + code) * 9;
    const jitter = ((code + index * 13) % 11) - 5;
    return 28 + wave + jitter;
  });
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 150;
      const y = 48 - ((value - min) / spread) * 38;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
