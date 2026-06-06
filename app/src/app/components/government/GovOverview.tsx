// GET /api/crises?status=active
// GET /api/alerts?status=active&type=&region=
// GET /api/heatmap?crisisId=&layer=
import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, MapPin, Activity, Cloud, Package, Shield, ChevronRight, Filter, Pin } from 'lucide-react';
import { Link } from 'react-router';
import SingaporeRegionMap from '../SingaporeRegionMap';

const crisisCards = [
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
    icon: Activity,
    color: 'orange',
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
    icon: Activity,
    color: 'red',
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
    icon: Cloud,
    color: 'blue',
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
    icon: Package,
    color: 'yellow',
  },
  {
    id: 'cyber',
    label: 'Cyber Incident',
    type: 'Cybersecurity',
    severity: 'low',
    path: '/gov/cybersecurity',
    stats: [
      { label: 'Active threats', value: '3', delta: '-1' },
    ],
    icon: Shield,
    color: 'purple',
  },
];

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

const alerts = [
  { id: 1, type: 'Weather', severity: 'high', message: 'Flash flood risk in Orchard & East Coast', region: 'East/Central', time: '10:23 AM' },
  { id: 2, type: 'Health', severity: 'high', message: 'New dengue red zone: Bedok North Ave 1', region: 'East', time: '09:45 AM' },
  { id: 3, type: 'Supply', severity: 'medium', message: 'Panadol Menstrual out-of-stock at 87 outlets', region: 'Nationwide', time: '08:30 AM' },
  { id: 4, type: 'Infrastructure', severity: 'medium', message: 'Power grid fluctuation in Woodlands', region: 'North', time: '07:15 AM' },
  { id: 5, type: 'Health', severity: 'medium', message: 'New Covid-19 cluster at Jurong West MRT', region: 'West', time: '06:50 AM' },
];

const trendData = [
  { date: 'May 13', incidents: 4 },
  { date: 'May 14', incidents: 5 },
  { date: 'May 15', incidents: 7 },
  { date: 'May 16', incidents: 6 },
  { date: 'May 17', incidents: 8 },
  { date: 'May 18', incidents: 9 },
  { date: 'May 19', incidents: 8 },
];

const filterTypes = ['All', 'Health', 'Weather', 'Supply', 'Infrastructure', 'Cybersecurity'];
const filterSeverities = ['All', 'High', 'Medium', 'Low'];
const filterRegions = ['All', 'North', 'South', 'East', 'West', 'Central', 'Nationwide'];

export default function GovOverview() {
  const [filterType, setFilterType] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterRegion, setFilterRegion] = useState('All');

  const filteredAlerts = alerts.filter((a) => {
    const typeMatch = filterType === 'All' || a.type === filterType;
    const sevMatch = filterSeverity === 'All' || a.severity === filterSeverity.toLowerCase();
    const regMatch = filterRegion === 'All' || a.region.includes(filterRegion);
    return typeMatch && sevMatch && regMatch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">National Crisis Command Centre</h1>
        <p className="text-zinc-400">Real-time overview of Singapore's crisis response systems</p>
      </div>

      {/* Horizontally scrollable crisis cards — GET /api/crises?status=active */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Active Crisis Situations</h2>
          <span className="text-xs text-zinc-600">Scroll to see all →</span>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
          {crisisCards.map((card) => {
            const Icon = card.icon;
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
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-600" />
              National Crisis Heatmap
            </h2>
            <span className="text-xs text-zinc-500">Pins linked to Active Alerts</span>
          </div>
          <div className="h-[440px]">
            <SingaporeRegionMap />
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
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${
                  alert.severity === 'high'
                    ? 'bg-red-950/30 border-red-800'
                    : alert.severity === 'medium'
                    ? 'bg-yellow-950/30 border-yellow-800'
                    : 'bg-blue-950/30 border-blue-800'
                }`}
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
              </div>
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
              Data projections indicate a moderate increase in respiratory cases over the next 72 hours due to deteriorating air quality. Supply disruptions for Panadol Menstrual may escalate if emergency procurement is not initiated. Recommend activating flood response protocols in eastern zones.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="px-2 py-1 bg-zinc-800 rounded">Confidence: 87%</span>
              <span className="px-2 py-1 bg-zinc-800 rounded">Sources: MOH, NEA, Enterprise SG</span>
              <span className="px-2 py-1 bg-yellow-900 text-yellow-400 rounded">Human Approval Required</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
