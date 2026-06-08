import { useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  Clock,
  Database,
  MapPin,
  Package,
  Ship,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import SingaporeRegionMap, { type MapMarker } from '../SingaporeRegionMap';
import { useApi } from '../../lib/api';

type SupplyViewId = 'panadol' | 'general';
type Severity = 'high' | 'medium' | 'low';

const supplyViews = [
  { id: 'panadol' as const, label: 'Panadol Menstrual Shortage', severity: 'medium', badge: 'bg-yellow-900 text-yellow-400', border: 'border-yellow-700' },
  { id: 'general' as const, label: 'General Supply Overview', severity: 'low', badge: 'bg-blue-900 text-blue-400', border: 'border-blue-700' },
];

const panadolData = {
  description: 'Islandwide shortage of Panadol Menstrual due to manufacturing disruption at the primary supplier. Emergency procurement is underway.',
  stats: [
    { label: 'Outlets Out of Stock', value: '87', delta: '+14 today', iconClass: 'bg-red-950 text-red-500' },
    { label: 'Affected Regions', value: '5 / 6', delta: '', iconClass: 'bg-orange-950 text-orange-500' },
    { label: 'Est. Restock (days)', value: '4', delta: '-1 day', iconClass: 'bg-green-950 text-green-500' },
    { label: 'Alt. Suppliers Found', value: '2', delta: '+2', iconClass: 'bg-blue-950 text-blue-500' },
  ],
  affectedLocations: [
    { name: 'Jurong West Cluster', stores: 18, region: 'West', severity: 'high' as Severity },
    { name: 'Tampines Hub Area', stores: 15, region: 'East', severity: 'high' as Severity },
    { name: 'Ang Mo Kio Hub', stores: 12, region: 'North', severity: 'medium' as Severity },
    { name: 'Orchard / Dhoby', stores: 22, region: 'Central', severity: 'medium' as Severity },
    { name: 'Woodlands Crescent', stores: 10, region: 'North', severity: 'low' as Severity },
    { name: 'Toa Payoh Central', stores: 10, region: 'Central', severity: 'low' as Severity },
  ],
  response: [
    { action: 'Contact Haleon alternate supplier in Malaysia', status: 'done' },
    { action: 'Contact Pharmaniaga regional supplier', status: 'done' },
    { action: 'Activate strategic health stockpile with MOH', status: 'pending' },
    { action: 'Issue public advisory on alternatives', status: 'pending' },
    { action: 'Coordinate distribution to priority outlets', status: 'pending' },
  ],
  pins: [
    { label: 'Jurong West', x: 18, y: 50, severity: 'high' as Severity },
    { label: 'Tampines', x: 73, y: 43, severity: 'high' as Severity },
    { label: 'Ang Mo Kio', x: 48, y: 28, severity: 'medium' as Severity },
    { label: 'Orchard', x: 43, y: 42, severity: 'medium' as Severity },
    { label: 'Woodlands', x: 38, y: 12, severity: 'low' as Severity },
    { label: 'Toa Payoh', x: 47, y: 35, severity: 'low' as Severity },
  ],
};

const pinColors: Record<Severity, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

const statusColors: Record<'done' | 'pending', string> = {
  done: 'bg-green-950/40 border-green-800 text-green-400',
  pending: 'bg-yellow-950/40 border-yellow-800 text-yellow-400',
};

function severity(value: number): MapMarker['severity'] {
  const magnitude = Math.abs(value);
  if (magnitude >= 10) return 'high';
  if (magnitude >= 3) return 'medium';
  return 'low';
}

function GeneralSupplyView() {
  const { data: dashboardData, loading, error } = useApi<any>('/api/dashboard/cached-external');
  const supply = dashboardData?.supply;
  const indicators = supply ? [...supply.importPrices, ...supply.retailSales] : [];
  const [selectedId, setSelectedId] = useState('');

  if (loading) return <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">Loading supply-chain dashboard data...</div>;
  if (error || !supply) return <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">Supply-chain dashboard API unavailable: {error ?? 'missing supply data'}</div>;

  const selected = indicators.find((indicator: any) => indicator.id === selectedId) ?? indicators[0];
  const markers: MapMarker[] = supply.nodes.map((node: any, index: number) => ({
    id: `supply-${index}`,
    name: node.name,
    latitude: node.latitude,
    longitude: node.longitude,
    value: `${selected.value}${selected.unit === 'Per Cent' ? '%' : ''}`,
    detail: `${node.role}. This is a national ${selected.period} indicator, not a node-specific stock reading.`,
    severity: severity(selected.value),
  }));

  return (
    <>
      <div className="flex items-start gap-3 rounded-xl border border-yellow-900/60 bg-yellow-950/20 p-4 text-sm">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
        <div>
          <div className="font-medium text-yellow-300">National indicators, clearly scoped</div>
          <p className="mt-1 text-zinc-400">SingStat does not publish medicine or food stock by planning area. The map therefore locates real logistics gateways while showing the selected national indicator consistently at each node.</p>
          <a className="mt-2 inline-block text-xs text-yellow-400 hover:text-yellow-300" href={supply.source.url} target="_blank" rel="noreferrer">{supply.source.label}</a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {supply.importPrices.map((indicator: any) => (
          <button key={indicator.id} onClick={() => setSelectedId(indicator.id)} className={`rounded-xl border p-5 text-left ${selected.id === indicator.id ? 'border-yellow-600 bg-yellow-950/20' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'}`}>
            <div className="mb-3 flex items-center justify-between">
              <Package className="h-5 w-5 text-yellow-500" />
              {indicator.value >= 0 ? <TrendingUp className="h-4 w-4 text-red-400" /> : <TrendingDown className="h-4 w-4 text-green-400" />}
            </div>
            <div className="text-2xl font-bold">{indicator.value}%</div>
            <div className="mt-1 text-sm text-zinc-400">{indicator.name.replace('Import Price Index - ', '')}</div>
            <div className="mt-2 text-xs text-zinc-600">{indicator.period} year-on-year</div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Ship className="h-5 w-5 text-yellow-500" />Logistics Node Context Map</h2>
            <p className="mt-1 text-xs text-zinc-500">SingStat updated {supply.updatedAt}</p>
          </div>
          <select value={selected?.id ?? ''} onChange={(event) => setSelectedId(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm">
            {indicators.map((indicator: any) => <option key={indicator.id} value={indicator.id}>{indicator.name}</option>)}
          </select>
        </div>
        <div className="h-[500px]">
          <SingaporeRegionMap
            markers={markers}
            emptyTitle={selected.name}
            emptyDetail="Hover a logistics node to see indicator scope"
            problemLabel="logistics nodes"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><BarChart3 className="h-5 w-5 text-yellow-500" />Import Price Changes</h2>
          <p className="mb-4 text-xs text-zinc-500">Latest annual percentage change by commodity section</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={supply.importPrices}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} tickFormatter={(value) => value.replace('Import Price Index - ', '')} />
              <YAxis stroke="#71717a" />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
              <Bar dataKey="value" fill="#eab308" radius={[6, 6, 0, 0]} name="Year-on-year change (%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-1 text-lg font-semibold">Retail Activity Indices</h2>
          <p className="mb-4 text-xs text-zinc-500">Latest monthly index, 2025 = 100</p>
          <div className="space-y-4">
            {supply.retailSales.map((indicator: any) => (
              <button key={indicator.id} onClick={() => setSelectedId(indicator.id)} className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-left hover:border-zinc-700">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium">{indicator.name}</span>
                  <span className="text-xl font-bold text-yellow-400">{indicator.value}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">Period: {indicator.period}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function PanadolSupplyView() {
  return (
    <>
      <div className="rounded-xl border border-yellow-700 bg-yellow-950/30 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-400" />
          <div>
            <div className="mb-1 font-semibold text-yellow-300">Active Supply Crisis: Panadol Menstrual</div>
            <p className="text-sm text-zinc-300">{panadolData.description}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {panadolData.stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className={`rounded-lg p-2 ${stat.iconClass}`}>
                <Package className="h-5 w-5" />
              </div>
              {stat.delta ? <span className="text-xs text-zinc-400">{stat.delta}</span> : null}
            </div>
            <div className="mb-1 text-2xl font-bold">{stat.value}</div>
            <div className="text-sm text-zinc-400">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MapPin className="h-5 w-5 text-yellow-500" />
            Shortage Location Map - Panadol Menstrual
          </h2>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><div className="h-3 w-3 rounded-full bg-red-500" />Critical</span>
            <span className="flex items-center gap-1"><div className="h-3 w-3 rounded-full bg-yellow-500" />Moderate</span>
            <span className="flex items-center gap-1"><div className="h-3 w-3 rounded-full bg-blue-500" />Minor</span>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-lg bg-zinc-800" style={{ paddingBottom: '46%' }}>
          <div className="absolute inset-0">
            <svg viewBox="0 0 100 46" className="h-full w-full opacity-10" fill="none">
              <path d="M5,18 Q15,8 30,6 Q50,3 70,10 Q85,14 95,18 Q90,30 80,36 Q65,42 50,42 Q35,42 20,36 Q8,28 5,18Z" fill="#eab308" />
            </svg>
            {panadolData.pins.map((pin) => (
              <div key={pin.label} className="group absolute" style={{ left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%,-50%)' }}>
                <div className={`h-5 w-5 cursor-pointer rounded-full border-2 border-white/30 ${pinColors[pin.severity]} animate-pulse`} />
                <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 group-hover:block">
                  <div className="whitespace-nowrap rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs">{pin.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">Affected Store Clusters</h2>
          <div className="space-y-3">
            {panadolData.affectedLocations.map((location) => (
              <div
                key={location.name}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  location.severity === 'high' ? 'border-red-800 bg-red-950/30' :
                  location.severity === 'medium' ? 'border-yellow-800 bg-yellow-950/30' :
                  'border-blue-800 bg-blue-950/30'
                }`}
              >
                <div>
                  <div className="text-sm font-medium">{location.name}</div>
                  <div className="text-xs text-zinc-400">{location.region} region</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{location.stores}</div>
                  <div className="text-xs text-zinc-500">outlets</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Zap className="h-5 w-5 text-yellow-500" />
            Recommended Response Actions
          </h2>
          <div className="mb-6 space-y-2">
            {panadolData.response.map((response) => (
              <div key={response.action} className={`flex items-center justify-between rounded-lg border p-3 ${statusColors[response.status as 'done' | 'pending']}`}>
                <span className="text-sm">{response.action}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${response.status === 'done' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
                  {response.status === 'done' ? 'Done' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Clock className="h-4 w-4" />
            <span>Estimated full restock: 4 days - subject to procurement outcome</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-yellow-900/50 bg-gradient-to-r from-yellow-950/50 to-orange-950/50 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-yellow-900/50 p-3"><AlertCircle className="h-6 w-6 text-yellow-400" /></div>
          <div className="flex-1">
            <h3 className="mb-2 font-semibold">Data Projection - Panadol Shortage</h3>
            <p className="mb-3 text-sm text-zinc-300">
              If alternate supplier procurement proceeds, full restock is expected within 4 days. Without intervention, the shortage may escalate to adjacent medicine categories within 2 weeks. Recommend immediate distribution of strategic stockpile to high-severity zones.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded bg-zinc-800 px-2 py-1">Confidence: 88%</span>
              <span className="rounded bg-zinc-800 px-2 py-1">Risk Timeline: 4-14 days</span>
              <span className="rounded bg-red-900 px-2 py-1 text-red-400">Action Required: Immediate</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function GovSupplyChain() {
  const [selectedView, setSelectedView] = useState<SupplyViewId>('general');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const currentView = supplyViews.find((view) => view.id === selectedView)!;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Supply Chain Monitoring</h1>
          <p className="text-zinc-400">Critical resource tracking, shortage alerts, and import dependency analysis</p>
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
              {supplyViews.map((view) => (
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

      {selectedView === 'panadol' ? <PanadolSupplyView /> : <GeneralSupplyView />}
    </div>
  );
}
