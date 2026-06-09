// GET /api/crises?status=active
// GET /api/alerts?status=active&type=&region=
// GET /api/heatmap?crisisId=&layer=
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, MapPin, Activity, Cloud, Package, Shield, ChevronRight, Filter, Pin } from 'lucide-react';
import { Link } from 'react-router';
import SingaporeRegionMap, { type MapMarker } from '../SingaporeRegionMap';
import { useApi } from '../../lib/api';
import { resolveAlertLocations } from '../../lib/singaporeLocations';

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
type AlertItem = { id: number | string; type: string; severity: string; message: string; region: string; time?: string };
type OverviewData = {
  crises: unknown[];
  alerts: AlertItem[];
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
  { id: 'covid', label: 'Covid-19', type: 'Health', severity: 'medium', path: '/gov/pandemic', stats: [{ label: 'Active cases today', value: '378', delta: '+12%' }, { label: 'ICU occupancy', value: '25', delta: '+5' }], icon: 'Activity' },
  { id: 'dengue', label: 'Dengue', type: 'Health', severity: 'high', path: '/gov/pandemic', stats: [{ label: 'Red zone clusters', value: '14', delta: '+3' }, { label: 'Cases this week', value: '212', delta: '+8%' }], icon: 'Activity' },
  { id: 'flood', label: 'Flash Flood Risk', type: 'Weather', severity: 'high', path: '/gov/weather', stats: [{ label: 'High-risk zones', value: '6', delta: '' }, { label: 'Peak rainfall (1h)', value: '45mm', delta: 'Alert' }], icon: 'Cloud' },
  { id: 'panadol', label: 'Panadol Shortage', type: 'Supply Chain', severity: 'medium', path: '/gov/supply-chain', stats: [{ label: 'Affected outlets', value: '87', delta: '' }, { label: 'Est. restock', value: '4 days', delta: '' }], icon: 'Package' },
  { id: 'cyber', label: 'Cyber Incident', type: 'Cybersecurity', severity: 'low', path: '/gov/cybersecurity', stats: [{ label: 'Active threats', value: '3', delta: '-1' }], icon: 'Shield' },
];
const fallbackAlerts: AlertItem[] = [
  { id: 1, type: 'Weather', severity: 'high', message: 'Flash flood risk in Orchard & East Coast', region: 'East/Central', time: '10:23 AM' },
  { id: 2, type: 'Health', severity: 'high', message: 'New dengue red zone: Bedok North Ave 1', region: 'East', time: '09:45 AM' },
  { id: 3, type: 'Supply', severity: 'medium', message: 'Panadol Menstrual out-of-stock at 87 outlets', region: 'Nationwide', time: '08:30 AM' },
  { id: 4, type: 'Infrastructure', severity: 'medium', message: 'Power grid fluctuation in Woodlands', region: 'North', time: '07:15 AM' },
  { id: 5, type: 'Health', severity: 'medium', message: 'New Covid-19 cluster at Jurong West MRT', region: 'West', time: '06:50 AM' },
];
const trendData: Array<{ date: string; incidents: number }> = [];

const filterTypes = ['All', 'Health', 'Weather', 'Supply', 'Infrastructure', 'Cybersecurity'];
const filterSeverities = ['All', 'High', 'Medium', 'Low'];
const filterRegions = ['All', 'North', 'South', 'East', 'West', 'Central', 'Nationwide'];

export default function GovOverview() {
  const { data, loading, error } = useApi<OverviewData>('/api/gov/overview');
  const [filterType, setFilterType] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterRegion, setFilterRegion] = useState('All');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | number | null>(null);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const alertsListRef = useRef<HTMLDivElement | null>(null);
  const apiCrisisCards = data?.overview?.crisisCards ?? [];
  const crisisCards: CrisisCard[] = apiCrisisCards.length > 0 ? apiCrisisCards : fallbackCrisisCards;
  const apiAlerts = data?.alerts ?? [];
  const alerts = apiAlerts.length > 0 ? apiAlerts : fallbackAlerts;
  const trendData = data?.overview?.incidentTrend ?? [];
  const riskSummary = data?.overview?.riskSummary;

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (filtersRef.current && !filtersRef.current.contains(event.target as Node)) {
        setFiltersOpen(false);
      }
      if (selectedAlertId && alertsListRef.current && !alertsListRef.current.contains(target)) {
        setSelectedAlertId(null);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [selectedAlertId]);

  const filteredAlerts = alerts.filter((a) => {
    const typeMatch = filterType === 'All' || a.type === filterType;
    const sevMatch = filterSeverity === 'All' || a.severity === filterSeverity.toLowerCase();
    const regMatch = filterRegion === 'All' || a.region.includes(filterRegion);
    return typeMatch && sevMatch && regMatch;
  });

  useEffect(() => {
    if (selectedAlertId && !filteredAlerts.some((alert) => alert.id === selectedAlertId)) {
      setSelectedAlertId(null);
    }
  }, [filteredAlerts, selectedAlertId]);

  const mapMarkers = useMemo<MapMarker[]>(() => {
    const baseAlerts = selectedAlertId ? filteredAlerts.filter((alert) => alert.id === selectedAlertId) : filteredAlerts;
    return baseAlerts.flatMap((alert) =>
      resolveAlertLocations(alert.region, alert.message).map((location, index) => ({
        id: `${alert.id}-${index}`,
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        value: alert.severity.toUpperCase(),
        detail: `${alert.type}: ${alert.message}`,
        severity: alert.severity as 'high' | 'medium' | 'low',
      })),
    );
  }, [filteredAlerts, selectedAlertId]);

  const focusAlertOnMap = (alert: (typeof filteredAlerts)[number]) => {
    setSelectedAlertId((current) => (current === alert.id ? null : alert.id));
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
          {crisisCards.map((card) => {
            const Icon = iconMap[card.icon as keyof typeof iconMap] ?? AlertCircle;
            const stats = Array.isArray(card.stats) ? card.stats : [];
            const primaryStat = stats[0];
            const secondaryStat = stats[1];
            return (
              <Link
                key={card.id}
                to={card.path}
                className="group relative min-h-[184px] w-[21rem] flex-shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-zinc-700 hover:bg-zinc-800/80"
              >
                <div className="absolute inset-x-0 bottom-0 h-px bg-zinc-700/60" />
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="flex items-start gap-2 text-xs text-zinc-500">
                    <Icon className="h-4 w-4 flex-shrink-0 text-zinc-500" />
                    <span className="leading-4 text-zinc-400">{card.type}</span>
                    <ChevronRight className="h-3 w-3 text-zinc-600 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityBadge[card.severity]}`}>
                    {card.severity}
                  </span>
                </div>

                <div className="grid min-h-[118px] grid-cols-[minmax(0,1fr)_124px] gap-4">
                  <div className="min-w-0">
                    <div className="mb-3 text-sm font-semibold leading-5 text-zinc-100">
                      {card.label}
                    </div>
                    <div className="mb-3 flex items-end gap-3">
                      <div className="text-3xl font-bold tracking-tight text-zinc-50">
                        {primaryStat?.value ?? '--'}
                      </div>
                      {primaryStat?.delta ? <span className="pb-1 text-xs font-medium text-zinc-400">{primaryStat.delta}</span> : null}
                    </div>
                    <div className="text-xs leading-5 text-zinc-500">{primaryStat?.label ?? 'Current metric'}</div>
                    {secondaryStat ? (
                      <div className="mt-1 text-xs leading-5 text-zinc-500">
                        {secondaryStat.label}: <span className="font-semibold text-zinc-200">{secondaryStat.value}</span>
                        {secondaryStat.delta ? <span className="ml-2 text-zinc-400">{secondaryStat.delta}</span> : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex h-[94px] w-[124px] items-center justify-center self-center rounded-lg bg-zinc-950/35 px-2 py-2">
                    <MiniTrend
                      color={severitySpark[card.severity] ?? '#34d399'}
                      seed={String(card.id)}
                    />
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
            <div ref={filtersRef} className="relative">
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                className={`rounded-lg p-2 transition-colors ${
                  filtersOpen || filterType !== 'All' || filterSeverity !== 'All' || filterRegion !== 'All'
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
                aria-label="Filter active alerts"
              >
                <Filter className="w-4 h-4" />
              </button>
              {filtersOpen && (
                <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-zinc-800 bg-zinc-950 p-3 shadow-2xl">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Filters</div>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterType('All');
                        setFilterSeverity('All');
                        setFilterRegion('All');
                      }}
                      className="text-xs text-zinc-500 transition-colors hover:text-zinc-200"
                    >
                      Reset
                    </button>
                  </div>
                  <FilterGroup label="Type">
                    {filterTypes.map((t) => (
                      <FilterChip key={t} active={filterType === t} onClick={() => setFilterType(t)}>
                        {t}
                      </FilterChip>
                    ))}
                  </FilterGroup>
                  <FilterGroup label="Severity">
                    {filterSeverities.map((s) => (
                      <FilterChip key={s} active={filterSeverity === s} onClick={() => setFilterSeverity(s)}>
                        {s}
                      </FilterChip>
                    ))}
                  </FilterGroup>
                  <FilterGroup label="Region">
                    {filterRegions.map((r) => (
                      <FilterChip key={r} active={filterRegion === r} onClick={() => setFilterRegion(r)}>
                        {r}
                      </FilterChip>
                    ))}
                  </FilterGroup>
                </div>
              )}
            </div>
          </div>

          <div className="mb-4 flex min-h-5 flex-wrap items-center gap-1.5 text-xs text-zinc-500">
            {[filterType, filterSeverity, filterRegion].filter((value) => value !== 'All').map((value) => (
              <span key={value} className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-zinc-300">
                {value}
              </span>
            ))}
          </div>

          <div ref={alertsListRef} className="space-y-2 flex-1 overflow-y-auto">
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
                } ${selectedAlertId === alert.id ? 'border-white/60 bg-zinc-800/85 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)]' : ''} w-full text-left transition-colors hover:bg-zinc-800/60`}
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

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 text-xs font-medium text-zinc-500">{label}</div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-xs transition-colors ${
        active ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  );
}

function MiniTrend({ color, seed }: { color: string; seed: string }) {
  const points = useMemo(() => buildSparkline(seed), [seed]);
  const gradientId = `trend-${seed.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  return (
    <svg viewBox="0 0 150 46" className="h-14 w-full overflow-visible" role="img" aria-label="Illustrative crisis trend">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${points} 150,46 0,46`} fill={`url(#${gradientId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" opacity="1" />
    </svg>
  );
}

function buildSparkline(seed: string) {
  const values = Array.from({ length: 28 }, (_, index) => {
    const code = seed.charCodeAt(index % seed.length) || 42;
    const progress = index / 27;
    const slope = progress * 28;
    const wave = Math.sin(index * 0.55 + code) * 3.2;
    const jitter = (((code + index * 7) % 5) - 2) * 0.9;
    return 18 + slope + wave + jitter;
  });
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 150;
      const y = 41 - ((value - min) / spread) * 32;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
