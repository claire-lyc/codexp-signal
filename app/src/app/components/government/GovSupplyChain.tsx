import { useState } from 'react';
import { BarChart3, Database, Package, Ship, TrendingDown, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import SingaporeRegionMap, { type MapMarker } from '../SingaporeRegionMap';
import dashboardData from '../../../data/dashboard-data.json';

const supply = dashboardData.supply;
const indicators = [...supply.importPrices, ...supply.retailSales];

function severity(value: number): MapMarker['severity'] {
  const magnitude = Math.abs(value);
  if (magnitude >= 10) return 'high';
  if (magnitude >= 3) return 'medium';
  return 'low';
}

export default function GovSupplyChain() {
  const [selectedId, setSelectedId] = useState(indicators[0].id);
  const selected = indicators.find((indicator) => indicator.id === selectedId) ?? indicators[0];
  const markers: MapMarker[] = supply.nodes.map((node, index) => ({
    id: `supply-${index}`,
    name: node.name,
    latitude: node.latitude,
    longitude: node.longitude,
    value: `${selected.value}${selected.unit === 'Per Cent' ? '%' : ''}`,
    detail: `${node.role}. This is a national ${selected.period} indicator, not a node-specific stock reading.`,
    severity: severity(selected.value),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Supply Chain Monitoring</h1>
        <p className="text-zinc-400">Official import-price and retail-activity indicators with key logistics nodes</p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-yellow-900/60 bg-yellow-950/20 p-4 text-sm">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
        <div>
          <div className="font-medium text-yellow-300">National indicators, clearly scoped</div>
          <p className="mt-1 text-zinc-400">SingStat does not publish medicine or food stock by planning area. The map therefore locates real logistics gateways while showing the selected national indicator consistently at each node.</p>
          <a className="mt-2 inline-block text-xs text-yellow-400 hover:text-yellow-300" href={supply.source.url} target="_blank" rel="noreferrer">{supply.source.label}</a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {supply.importPrices.map((indicator) => (
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
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm">
            {indicators.map((indicator) => <option key={indicator.id} value={indicator.id}>{indicator.name}</option>)}
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
            {supply.retailSales.map((indicator) => (
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
    </div>
  );
}
