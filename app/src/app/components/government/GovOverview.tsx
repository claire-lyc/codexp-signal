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
type OverviewData = {
  crises: unknown[];
  alerts: typeof alerts;
  overview: {
    crisisCards: Array<{
      id: string;
      label: string;
      type: string;
      severity: string;
      path: string;
      stats: Array<{ label: string; value: string; delta: string }>;
      icon: string;
    }>;
    incidentTrend: Array<{ date: string; incidents: number }>;
    riskSummary: { body: string; confidence: number; sources: string };
  };
};

const severityBorder: Record<string, string> = {
  high: 'border-red-700',
  medium: 'border-yellow-700',
  low: 'border-blue-700',
};
const severityBadge: Record<string, string> = {
  high: 'bg-red-900 text-red-400',
  medium: 'bg-yellow-900 text-yellow-400',
  low: 'bg-blue-900 text-blue-400',
};

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
  const crisisCards = data?.overview?.crisisCards ?? [];
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
          {crisisCards.map((card) => {
            const Icon = iconMap[card.icon as keyof typeof iconMap] ?? AlertCircle;
            return (
              <Link
                key={card.id}
                to={card.path}
                className={`flex-shrink-0 w-64 bg-zinc-900 border ${severityBorder[card.severity]} rounded-xl p-5 hover:bg-zinc-800 transition-colors group`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-zinc-800 rounded-lg">
                      <Icon className="w-4 h-4 text-zinc-300" />
                    </div>
                    <span className="text-xs text-zinc-500">{card.type}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${severityBadge[card.severity]}`}>
                    {card.severity.toUpperCase()}
                  </span>
                </div>
                <div className="font-semibold mb-3">{card.label}</div>
                <div className="space-y-1.5">
                  {card.stats.map((s, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">{s.label}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold">{s.value}</span>
                        {s.delta && <span className="text-xs text-zinc-500">{s.delta}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1 mt-3 text-xs text-red-500 group-hover:text-red-400 transition-colors">
                  <span>View details</span>
                  <ChevronRight className="w-3 h-3" />
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
