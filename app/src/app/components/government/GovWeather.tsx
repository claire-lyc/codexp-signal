import { useState } from 'react';
import { Cloud, Database, Droplets, Layers, ThermometerSun, Wind } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import SingaporeRegionMap, { type MapMarker } from '../SingaporeRegionMap';
import dashboardData from '../../../data/dashboard-data.json';

type LayerKey = 'Rainfall' | 'Temperature' | 'Wind' | 'PSI';

const weather = dashboardData.weather;
const layers: LayerKey[] = ['Rainfall', 'Temperature', 'Wind', 'PSI'];

function severity(layer: LayerKey, value: number): MapMarker['severity'] {
  if (layer === 'Rainfall') return value >= 10 ? 'high' : value >= 2 ? 'medium' : 'low';
  if (layer === 'Temperature') return value >= 34 ? 'high' : value >= 32 ? 'medium' : 'low';
  if (layer === 'Wind') return value >= 20 ? 'high' : value >= 10 ? 'medium' : 'low';
  return value > 100 ? 'high' : value > 50 ? 'medium' : 'low';
}

function layerData(layer: LayerKey) {
  if (layer === 'PSI') {
    return {
      unit: weather.psi.unit,
      timestamp: weather.psi.timestamp,
      rows: weather.psi.regions.map((region) => ({
        id: `psi-${region.name}`,
        name: `${region.name[0].toUpperCase()}${region.name.slice(1)} region`,
        latitude: region.labelLocation.latitude,
        longitude: region.labelLocation.longitude,
        value: region.value,
      })),
    };
  }

  const key = layer.toLowerCase() as 'rainfall' | 'temperature' | 'wind';
  const source = weather[key];
  return {
    unit: layer === 'Wind' ? 'knots' : source.unit,
    timestamp: source.timestamp,
    rows: source.stations.map((station) => ({
      id: station.id,
      name: station.name,
      latitude: station.location.latitude,
      longitude: station.location.longitude,
      value: station.value,
    })),
  };
}

export default function GovWeather() {
  const [activeLayer, setActiveLayer] = useState<LayerKey>('Rainfall');
  const current = layerData(activeLayer);
  const sorted = [...current.rows].sort((a, b) => b.value - a.value);
  const markers: MapMarker[] = current.rows.map((row) => ({
    id: `${activeLayer}-${row.id}`,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    value: `${row.value} ${current.unit}`,
    detail: `Official ${activeLayer.toLowerCase()} reading`,
    severity: severity(activeLayer, row.value),
  }));
  const average = current.rows.reduce((sum, row) => sum + row.value, 0) / current.rows.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Weather & Climate Monitoring</h1>
        <p className="text-zinc-400">Latest available NEA station and regional readings</p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-900/60 bg-blue-950/20 p-4 text-sm">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
        <div>
          <div className="font-medium text-blue-300">Real data.gov.sg readings</div>
          <p className="mt-1 text-zinc-400">Values are cached locally by the refresh script so the dashboard remains available if the live endpoint is temporarily unreachable.</p>
          <a className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300" href={weather.source.url} target="_blank" rel="noreferrer">{weather.source.label}</a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {([
          ['Rainfall', Droplets],
          ['Temperature', ThermometerSun],
          ['Wind', Wind],
          ['PSI', Cloud],
        ] as const).map(([layer, Icon]) => {
          const data = layerData(layer);
          const max = Math.max(...data.rows.map((row) => row.value));
          return (
            <button key={layer} onClick={() => setActiveLayer(layer)} className={`rounded-xl border p-5 text-left transition-colors ${activeLayer === layer ? 'border-blue-600 bg-blue-950/30' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'}`}>
              <Icon className="mb-3 h-5 w-5 text-blue-400" />
              <div className="text-2xl font-bold">{max} <span className="text-sm text-zinc-500">{data.unit}</span></div>
              <div className="mt-1 text-sm text-zinc-400">Highest {layer}</div>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Layers className="h-5 w-5 text-blue-500" />Singapore Weather Map</h2>
            <div className="mt-1 text-xs text-zinc-500">Reading time: {new Date(current.timestamp).toLocaleString()}</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {layers.map((layer) => <button key={layer} onClick={() => setActiveLayer(layer)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${activeLayer === layer ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>{layer}</button>)}
          </div>
        </div>
        <div className="h-[500px]">
          <SingaporeRegionMap
            markers={markers}
            emptyTitle={`${activeLayer} readings`}
            emptyDetail="Hover a station marker for its latest published value"
            problemLabel={`${activeLayer.toLowerCase()} monitoring points`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 lg:col-span-2">
          <h2 className="mb-1 text-lg font-semibold">Highest Published Readings</h2>
          <p className="mb-4 text-xs text-zinc-500">Top stations/regions in this snapshot · average {average.toFixed(1)} {current.unit}</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sorted.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={75} />
              <YAxis stroke="#71717a" />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} name={`${activeLayer} (${current.unit})`} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">Reading Summary</h2>
          <dl className="space-y-4 text-sm">
            <div><dt className="text-zinc-500">Layer</dt><dd className="font-medium">{activeLayer}</dd></div>
            <div><dt className="text-zinc-500">Reporting locations</dt><dd className="font-medium">{current.rows.length}</dd></div>
            <div><dt className="text-zinc-500">Highest reading</dt><dd className="font-medium">{sorted[0]?.value} {current.unit}</dd></div>
            <div><dt className="text-zinc-500">Average reading</dt><dd className="font-medium">{average.toFixed(1)} {current.unit}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}
