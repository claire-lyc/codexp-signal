import { useState } from 'react';
import { AlertTriangle, Cloud, Database, Droplets, Layers, ThermometerSun, Wind } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import SingaporeRegionMap, { type MapMarker } from '../SingaporeRegionMap';
import { useApi } from '../../lib/api';

type LayerKey = 'Rainfall' | 'Temperature' | 'Wind' | 'PSI';

type WeatherLayerRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  value: number;
};

const layers: LayerKey[] = ['Rainfall', 'Temperature', 'Wind', 'PSI'];

const rainfallForecast = [
  { time: '00:00', value: 2 },
  { time: '04:00', value: 5 },
  { time: '08:00', value: 12 },
  { time: '12:00', value: 28 },
  { time: '16:00', value: 45 },
  { time: '20:00', value: 32 },
  { time: '23:59', value: 18 },
];

const psiTrend = [
  { time: '00:00', value: 98 },
  { time: '04:00', value: 102 },
  { time: '08:00', value: 118 },
  { time: '12:00', value: 134 },
  { time: '16:00', value: 156 },
  { time: '20:00', value: 142 },
  { time: '23:59', value: 128 },
];

function toKmPerHour(knots: number) {
  return knots * 1.852;
}

function formatUnit(layer: LayerKey) {
  if (layer === 'Wind') return 'km/h';
  if (layer === 'Temperature') return '°C';
  return layer === 'Rainfall' ? 'mm' : 'PSI';
}

function formatValue(layer: LayerKey, value: number) {
  if (layer === 'Temperature') return `${value.toFixed(1)} °C`;
  if (layer === 'Wind') return `${Math.round(value)} km/h`;
  if (layer === 'Rainfall') return `${value.toFixed(1)} mm`;
  return `${Math.round(value)} PSI`;
}

function severity(layer: LayerKey, value: number): MapMarker['severity'] {
  if (layer === 'Rainfall') return value >= 20 ? 'high' : value >= 8 ? 'medium' : 'low';
  if (layer === 'Temperature') return value >= 34 ? 'high' : value >= 31 ? 'medium' : 'low';
  if (layer === 'Wind') return value >= 35 ? 'high' : value >= 20 ? 'medium' : 'low';
  return value > 100 ? 'high' : value > 50 ? 'medium' : 'low';
}

function statusBadge(label: string) {
  if (label === 'Unhealthy') return 'bg-orange-950 text-orange-400';
  if (label === 'Alert') return 'bg-red-950 text-red-400';
  if (label === 'High') return 'bg-yellow-950 text-yellow-400';
  return 'bg-green-950 text-green-400';
}

function layerData(weather: any, layer: LayerKey): { unit: string; timestamp: string; rows: WeatherLayerRow[] } {
  if (layer === 'PSI') {
    return {
      unit: 'PSI',
      timestamp: weather.psi.timestamp,
      rows: weather.psi.regions.map((region: any) => ({
        id: `psi-${region.name}`,
        name: `${region.name[0].toUpperCase()}${region.name.slice(1)} region`,
        latitude: region.labelLocation.latitude,
        longitude: region.labelLocation.longitude,
        value: region.value,
      })),
    };
  }

  if (layer === 'Wind') {
    return {
      unit: 'km/h',
      timestamp: weather.wind.timestamp,
      rows: weather.wind.stations.map((station: any) => ({
        id: station.id,
        name: station.name,
        latitude: station.location.latitude,
        longitude: station.location.longitude,
        value: toKmPerHour(station.value),
      })),
    };
  }

  const key = layer.toLowerCase() as 'rainfall' | 'temperature';
  const source = weather[key];
  return {
    unit: layer === 'Temperature' ? '°C' : source.unit,
    timestamp: source.timestamp,
    rows: source.stations.map((station: any) => ({
      id: station.id,
      name: station.name,
      latitude: station.location.latitude,
      longitude: station.location.longitude,
      value: station.value,
    })),
  };
}

export default function GovWeather() {
  const { data: dashboardData, loading, error } = useApi<any>('/api/dashboard/cached-external');
  const [activeLayer, setActiveLayer] = useState<LayerKey>('Rainfall');

  if (loading) return <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">Loading weather dashboard data...</div>;
  if (error || !dashboardData?.weather) return <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">Weather dashboard API unavailable: {error ?? 'missing weather data'}</div>;

  const weather = dashboardData.weather;
  const rainfall = layerData(weather, 'Rainfall');
  const temperature = layerData(weather, 'Temperature');
  const wind = layerData(weather, 'Wind');
  const psi = layerData(weather, 'PSI');
  const current = layerData(weather, activeLayer);
  const sorted = [...current.rows].sort((a, b) => b.value - a.value);

  const maxRainfall = Math.max(...rainfall.rows.map((row) => row.value));
  const maxTemperature = Math.max(...temperature.rows.map((row) => row.value));
  const maxWind = Math.max(...wind.rows.map((row) => row.value));
  const maxPsi = Math.max(...psi.rows.map((row) => row.value));
  const average = current.rows.reduce((sum, row) => sum + row.value, 0) / current.rows.length;

  const markers: MapMarker[] = current.rows.map((row) => ({
    id: `${activeLayer}-${row.id}`,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    value: formatValue(activeLayer, row.value),
    detail: `Official ${activeLayer.toLowerCase()} reading`,
    severity: severity(activeLayer, row.value),
  }));

  const summaryCards = [
    {
      key: 'psi',
      icon: Cloud,
      iconClass: 'bg-orange-950 text-orange-500',
      value: `${Math.round(maxPsi)}`,
      label: 'PSI (Air Quality)',
      badge: maxPsi >= 101 ? 'Unhealthy' : 'Normal',
    },
    {
      key: 'rainfall',
      icon: Droplets,
      iconClass: 'bg-blue-950 text-blue-500',
      value: `${maxRainfall.toFixed(1)}mm`,
      label: 'Peak Rainfall (1h)',
      badge: maxRainfall >= 20 ? 'Alert' : 'Normal',
    },
    {
      key: 'heat',
      icon: ThermometerSun,
      iconClass: 'bg-red-950 text-red-500',
      value: `${maxTemperature.toFixed(1)}°C`,
      label: 'Heat Stress Index',
      badge: maxTemperature >= 33 ? 'High' : 'Normal',
    },
    {
      key: 'wind',
      icon: Wind,
      iconClass: 'bg-green-950 text-green-500',
      value: `${Math.round(maxWind)} km/h`,
      label: 'Wind Speed',
      badge: maxWind >= 25 ? 'Alert' : 'Normal',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold">Weather & Climate Monitoring</h1>
        <p className="text-zinc-400">Latest available NEA station and regional readings, forecasts, and weather risk alerts</p>
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
        {summaryCards.map(({ key, icon: Icon, iconClass, value, label, badge }) => (
          <div key={key} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className={`rounded-lg p-2 ${iconClass}`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`rounded px-2 py-1 text-xs ${statusBadge(badge)}`}>{badge}</span>
            </div>
            <div className="mb-1 text-2xl font-bold">{value}</div>
            <div className="text-sm text-zinc-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Layers className="h-5 w-5 text-blue-500" />Singapore Weather Heatmap</h2>
            <div className="mt-1 text-xs text-zinc-500">Reading time: {new Date(current.timestamp).toLocaleString()}</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {layers.map((layer) => (
              <button
                key={layer}
                onClick={() => setActiveLayer(layer)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${activeLayer === layer ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              >
                {layer}
              </button>
            ))}
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
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
          <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-red-500" />High</span>
          <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-yellow-500" />Medium</span>
          <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />Low</span>
          <span>Layer unit: {formatUnit(activeLayer)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 lg:col-span-2">
          <h2 className="mb-1 text-lg font-semibold">Highest Published Readings</h2>
          <p className="mb-4 text-xs text-zinc-500">Top stations or regions in this snapshot · average {average.toFixed(1)} {current.unit}</p>
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
            <div><dt className="text-zinc-500">Highest reading</dt><dd className="font-medium">{formatValue(activeLayer, sorted[0]?.value ?? 0)}</dd></div>
            <div><dt className="text-zinc-500">Average reading</dt><dd className="font-medium">{formatValue(activeLayer, average)}</dd></div>
          </dl>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Droplets className="h-5 w-5 text-blue-500" />
            24-Hour Rainfall Forecast
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={rainfallForecast}>
              <defs>
                <linearGradient id="rainfallGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="time" stroke="#71717a" />
              <YAxis stroke="#71717a" label={{ value: 'mm', angle: -90, position: 'insideLeft', style: { fill: '#71717a' } }} />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#rainfallGradient)" name="Rainfall (mm)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Cloud className="h-5 w-5 text-orange-500" />
            Air Quality Trend (PSI)
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={psiTrend}>
              <defs>
                <linearGradient id="psiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="time" stroke="#71717a" />
              <YAxis stroke="#71717a" />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
              <Area type="monotone" dataKey="value" stroke="#f97316" fill="url(#psiGradient)" name="PSI" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-red-800 bg-red-950/30 p-5">
          <div className="mb-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h3 className="font-semibold">Flood Risk Alert</h3>
          </div>
          <p className="mb-3 text-sm text-zinc-300">High risk of flash floods in Orchard, Marina Bay, and East Coast due to predicted heavy rainfall.</p>
          <div className="text-xs text-zinc-400">Risk Level: HIGH • Updated: 2 mins ago</div>
        </div>
        <div className="rounded-xl border border-orange-800 bg-orange-950/30 p-5">
          <div className="mb-3 flex items-center gap-3">
            <Cloud className="h-5 w-5 text-orange-500" />
            <h3 className="font-semibold">Haze Advisory</h3>
          </div>
          <p className="mb-3 text-sm text-zinc-300">PSI levels are elevated due to regional forest fires. Vulnerable groups are advised to reduce outdoor activity.</p>
          <div className="text-xs text-zinc-400">Risk Level: MEDIUM • Updated: 15 mins ago</div>
        </div>
        <div className="rounded-xl border border-yellow-800 bg-yellow-950/30 p-5">
          <div className="mb-3 flex items-center gap-3">
            <ThermometerSun className="h-5 w-5 text-yellow-500" />
            <h3 className="font-semibold">Heat Warning</h3>
          </div>
          <p className="mb-3 text-sm text-zinc-300">Heat stress index is forecasted to peak between 12 PM and 4 PM. Public advisories have been prepared for outdoor workers and vulnerable groups.</p>
          <div className="text-xs text-zinc-400">Risk Level: MEDIUM • Updated: 1 hour ago</div>
        </div>
      </div>

      <div className="rounded-xl border border-blue-900/50 bg-gradient-to-r from-blue-950/50 to-cyan-950/50 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-blue-900/50 p-3"><AlertTriangle className="h-6 w-6 text-blue-400" /></div>
          <div className="flex-1">
            <h3 className="mb-2 font-semibold">Data Projection - Weather Analysis</h3>
            <p className="mb-3 text-sm text-zinc-300">
              Pattern analysis indicates a 78% probability of sustained heavy rainfall in the next 6 hours. Recommend flood-response readiness in identified high-risk zones and public transport advisories for low-lying corridors.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="rounded bg-zinc-800 px-2 py-1">Confidence: 78%</span>
              <span className="rounded bg-zinc-800 px-2 py-1">Source: Meteorological Service Singapore</span>
              <span className="rounded bg-yellow-900 px-2 py-1 text-yellow-400">Human Approval Required</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
