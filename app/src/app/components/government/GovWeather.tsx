import { useEffect, useState } from 'react';
import { AlertTriangle, Cloud, Database, Droplets, Layers, Pause, Play, ThermometerSun, Wind } from 'lucide-react';
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
import SingaporeRegionMap, {
  type HeatmapPalette,
  type MapHeatmapLayer,
  type MapMarker,
  type WeatherOverlayLayer,
} from '../SingaporeRegionMap';
import { useApi } from '../../lib/api';

type LayerKey = 'Rainfall' | 'Temperature' | 'Wind' | 'PSI';

type WeatherLayerRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  value: number;
  direction?: number | null;
};

type WeatherTrendPoint = {
  time: string;
  value: number;
};

type RainRadarData = {
  frames: Array<{ url: string; label: string; timestamp: string }>;
  basemapUrl: string;
  legendUrl: string;
  sourceUrl: string;
};

type HazeLayerData = {
  satelliteUrl: string;
  windUrl: string | null;
  basemapUrl: string;
  sourceUrl: string;
};

const layers: LayerKey[] = ['Rainfall', 'Temperature', 'Wind', 'PSI'];

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

function displayUnit(layer: LayerKey) {
  if (layer === 'Wind') return 'km/h';
  if (layer === 'Temperature') return 'deg C';
  return layer === 'Rainfall' ? 'mm' : 'PSI';
}

function displayValue(layer: LayerKey, value: number) {
  if (layer === 'Temperature') return `${value.toFixed(1)} deg C`;
  if (layer === 'Wind') return `${Math.round(value)} km/h`;
  if (layer === 'Rainfall') return `${value.toFixed(1)} mm`;
  return `${Math.round(value)} PSI`;
}

function heatmapPalette(layer: LayerKey): HeatmapPalette {
  if (layer === 'Temperature') return 'temperature';
  if (layer === 'Rainfall') return 'rainfall';
  if (layer === 'Wind') return 'wind';
  return 'psi';
}

function heatmapScale(layer: LayerKey) {
  if (layer === 'Temperature') return { min: 24, max: 36, radius: 62 };
  if (layer === 'Rainfall') return { min: 0, max: 40, radius: 54 };
  if (layer === 'Wind') return { min: 0, max: 45, radius: 62 };
  return { min: 0, max: 200, radius: 105 };
}

function agencyMapTitle(layer: LayerKey) {
  if (layer === 'Rainfall') return 'Rain Radar & Cloud Cells';
  if (layer === 'Temperature') return 'Surface Temperature Field';
  if (layer === 'Wind') return 'PSI & Wind Direction';
  return 'Regional Haze & PSI';
}

function agencyMapNote(layer: LayerKey, maxValue: number) {
  if (layer === 'Rainfall') {
    return maxValue >= 0.1
      ? 'Measured rainfall intensity is interpolated between official reporting stations.'
      : 'No measurable rainfall is currently reported; the surface remains near the low end of the scale.';
  }
  if (layer === 'Temperature') return 'Pulsing rings highlight warmer reporting stations over the interpolated temperature surface.';
  if (layer === 'Wind') return 'PSI conditions form the background surface while arrows show measured wind speed and direction at reporting stations.';
  return 'Soft haze bands follow the five regional PSI readings and intensify as air quality worsens.';
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
        direction: station.direction,
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

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function thinTrend(points: WeatherTrendPoint[], maxPoints = 24) {
  if (points.length <= maxPoints) return points;
  const interval = Math.ceil(points.length / maxPoints);
  return points.filter((_, index) => index % interval === 0 || index === points.length - 1);
}

function rainfallTrendData(weather: any, fallbackPeak: number): WeatherTrendPoint[] {
  const trend = Array.isArray(weather.rainfall?.trend) ? weather.rainfall.trend : [];
  if (trend.length) {
    return thinTrend(
      trend
        .slice()
        .sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime())
        .map((point: any) => ({ time: timeLabel(point.time), value: Number(point.value) }))
        .filter((point: WeatherTrendPoint) => Number.isFinite(point.value)),
      );
  }

  return [{ time: timeLabel(weather.rainfall.timestamp), value: fallbackPeak }];
}

function psiTrendData(weather: any, fallbackAverage: number): WeatherTrendPoint[] {
  const trend = Array.isArray(weather.psi?.trend) ? weather.psi.trend : [];
  if (trend.length) {
    return thinTrend(
      trend
        .slice()
        .sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime())
        .map((point: any) => ({ time: timeLabel(point.time), value: Number(point.value) }))
        .filter((point: WeatherTrendPoint) => Number.isFinite(point.value)),
      );
  }

  return [{ time: timeLabel(weather.psi.timestamp), value: Math.round(fallbackAverage) }];
}

function RainRadarMap({ data }: { data: RainRadarData }) {
  const [frameIndex, setFrameIndex] = useState(Math.max(data.frames.length - 1, 0));
  const [playing, setPlaying] = useState(false);
  const frame = data.frames[frameIndex];

  useEffect(() => {
    setFrameIndex(Math.max(data.frames.length - 1, 0));
  }, [data.frames.length]);

  useEffect(() => {
    if (!playing || data.frames.length < 2) return;
    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % data.frames.length);
    }, 900);
    return () => window.clearInterval(timer);
  }, [data.frames.length, playing]);

  if (!frame) {
    return <div className="grid h-full place-items-center rounded-lg bg-zinc-950 text-sm text-zinc-500">No NEA radar frames available</div>;
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-700 bg-[#f4f4f5]">
        <img src={data.basemapUrl} alt="NEA 240 km regional rain radar basemap" className="absolute inset-0 h-full w-full object-contain" />
        <img
          key={frame.url}
          src={frame.url}
          alt={`NEA rain radar frame ${frame.label}`}
          className="absolute inset-0 h-full w-full object-contain"
        />
        <div className="absolute left-3 top-3 rounded-md border border-zinc-300 bg-white/90 px-3 py-2 text-xs text-zinc-800 shadow-sm backdrop-blur">
          <div className="font-semibold">NEA Singapore rain radar</div>
          <div className="mt-0.5 text-zinc-600">{frame.label}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying((current) => !current)}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {playing ? 'Pause radar' : 'Play radar'}
        </button>
        <input
          type="range"
          min="0"
          max={Math.max(data.frames.length - 1, 0)}
          value={frameIndex}
          onChange={(event) => {
            setPlaying(false);
            setFrameIndex(Number(event.target.value));
          }}
          className="min-w-48 flex-1 accent-cyan-500"
          aria-label="Rain radar frame"
        />
        <span className="min-w-28 text-right text-xs text-zinc-400">{frame.label}</span>
      </div>

      <img src={data.legendUrl} alt="NEA rain intensity legend" className="h-8 max-w-full object-contain object-left" />
    </div>
  );
}

function HazeSatelliteMap({ data }: { data: HazeLayerData }) {
  const [showWind, setShowWind] = useState(true);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-700 bg-[#a8c8db]">
        <img src={data.basemapUrl} alt="NEA regional haze basemap" className="absolute inset-0 h-full w-full object-contain" />
        <img src={data.satelliteUrl} alt="NEA regional haze satellite cloud layer" className="absolute inset-0 h-full w-full object-contain opacity-80 mix-blend-screen" />
        {showWind && data.windUrl ? (
          <img src={data.windUrl} alt="NEA regional haze wind layer" className="absolute inset-0 h-full w-full object-contain" />
        ) : null}
        <div className="absolute left-3 top-3 rounded-md border border-zinc-300 bg-white/90 px-3 py-2 text-xs text-zinc-800 shadow-sm backdrop-blur">
          <div className="font-semibold">NEA regional haze satellite</div>
          <div className="mt-0.5 text-zinc-600">Cloud cover and regional transport context</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={showWind}
            onChange={(event) => setShowWind(event.target.checked)}
            className="h-4 w-4 accent-cyan-500"
          />
          NEA regional wind overlay
        </label>
        <a href={data.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300">
          Open NEA source
        </a>
      </div>
    </div>
  );
}

export default function GovWeather() {
  const { data: dashboardData, loading, error } = useApi<any>('/api/dashboard/cached-external');
  const { data: rainRadarData } = useApi<RainRadarData>('/api/gov/weather/rain-radar', 5 * 60 * 1000);
  const { data: hazeLayerData } = useApi<HazeLayerData>('/api/gov/weather/haze-layers', 30 * 60 * 1000);
  const [activeLayer, setActiveLayer] = useState<LayerKey>('Rainfall');
  const [mapView, setMapView] = useState<'agency' | 'interactive'>('agency');

  useEffect(() => {
    setMapView(activeLayer === 'Rainfall' || activeLayer === 'PSI' ? 'agency' : 'interactive');
  }, [activeLayer]);

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
  const averagePsi = psi.rows.reduce((sum, row) => sum + row.value, 0) / psi.rows.length;
  const average = current.rows.reduce((sum, row) => sum + row.value, 0) / current.rows.length;
  const rainfallChartData = rainfallTrendData(weather, maxRainfall);
  const psiChartData = psiTrendData(weather, averagePsi);

  const markers: MapMarker[] = current.rows.map((row) => ({
    id: `${activeLayer}-${row.id}`,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    value: displayValue(activeLayer, row.value),
    detail: `Official ${activeLayer.toLowerCase()} reading`,
    severity: severity(activeLayer, row.value),
  }));
  const mapSurface = activeLayer === 'Wind' ? psi : current;
  const mapSurfaceLayer: LayerKey = activeLayer === 'Wind' ? 'PSI' : activeLayer;
  const scale = heatmapScale(mapSurfaceLayer);
  const heatmapLayer: MapHeatmapLayer = {
    label: activeLayer === 'Wind' ? 'PSI with wind' : activeLayer,
    unit: displayUnit(mapSurfaceLayer),
    palette: heatmapPalette(mapSurfaceLayer),
    points: mapSurface.rows.map((row) => ({
      id: `${mapSurfaceLayer}-${row.id}`,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
      value: row.value,
    })),
    min: scale.min,
    max: scale.max,
    radius: scale.radius,
    opacity: activeLayer === 'Rainfall' ? 0.98 : 0.94,
    cellSize: activeLayer === 'Temperature' ? 3 : 7,
    legendLabel: activeLayer === 'Wind' ? 'Low to high PSI' : 'Low to high intensity',
    currentValue: mapSurface.rows.reduce((sum, row) => sum + row.value, 0) / mapSurface.rows.length,
  };
  const weatherOverlay: WeatherOverlayLayer | undefined = activeLayer === 'Rainfall' ? undefined : {
    kind: activeLayer.toLowerCase() as WeatherOverlayLayer['kind'],
    points: current.rows.map((row) => ({
      id: `${activeLayer}-${row.id}`,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
      value: row.value,
      direction: row.direction,
    })),
  };

  const summaryCards: Array<{
    key: string;
    layer: LayerKey;
    icon: typeof Cloud;
    iconClass: string;
    value: string;
    label: string;
    badge: string;
  }> = [
    {
      key: 'rainfall',
      layer: 'Rainfall',
      icon: Droplets,
      iconClass: 'bg-blue-950 text-blue-500',
      value: `${maxRainfall.toFixed(1)}mm`,
      label: 'Peak Rainfall (1h)',
      badge: maxRainfall >= 20 ? 'Alert' : 'Normal',
    },
    {
      key: 'heat',
      layer: 'Temperature',
      icon: ThermometerSun,
      iconClass: 'bg-red-950 text-red-500',
      value: `${maxTemperature.toFixed(1)}°C`,
      label: 'Heat Stress Index',
      badge: maxTemperature >= 33 ? 'High' : 'Normal',
    },
    {
      key: 'wind',
      layer: 'Wind',
      icon: Wind,
      iconClass: 'bg-green-950 text-green-500',
      value: `${Math.round(maxWind)} km/h`,
      label: 'Wind Speed',
      badge: maxWind >= 25 ? 'Alert' : 'Normal',
    },
    {
      key: 'psi',
      layer: 'PSI',
      icon: Cloud,
      iconClass: 'bg-orange-950 text-orange-500',
      value: `${Math.round(maxPsi)}`,
      label: 'PSI (Air Quality)',
      badge: maxPsi >= 101 ? 'Unhealthy' : 'Normal',
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
        {summaryCards.map(({ key, layer, icon: Icon, iconClass, value, label, badge }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveLayer(layer)}
            className={`rounded-xl border bg-zinc-900 p-5 text-left transition-colors ${
              activeLayer === layer
                ? 'border-blue-600 ring-1 ring-blue-600'
                : 'border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className={`rounded-lg p-2 ${iconClass}`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`rounded px-2 py-1 text-xs ${statusBadge(badge)}`}>{badge}</span>
            </div>
            <div className="mb-1 text-2xl font-bold">{value}</div>
            <div className="text-sm text-zinc-400">{label}</div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Layers className="h-5 w-5 text-blue-500" />{agencyMapTitle(activeLayer)}</h2>
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {activeLayer === 'Rainfall' || activeLayer === 'PSI' ? (
            <div className="inline-flex rounded-md border border-zinc-700 bg-zinc-950 p-1" aria-label={`${activeLayer} map view`}>
              <button
                type="button"
                onClick={() => setMapView('agency')}
                className={`rounded px-3 py-1.5 text-xs font-medium ${
                  mapView === 'agency' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {activeLayer === 'Rainfall' ? 'NEA radar' : 'NEA satellite'}
              </button>
              <button
                type="button"
                onClick={() => setMapView('interactive')}
                className={`rounded px-3 py-1.5 text-xs font-medium ${
                  mapView === 'interactive' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Interactive map
              </button>
            </div>
          ) : (
            <span className="text-xs text-zinc-500">
              {activeLayer === 'Wind' ? 'Combined air-quality and wind view' : 'Live station interpolation'}
            </span>
          )}
        </div>
        <div className="h-[560px]">
          {activeLayer === 'Rainfall' && mapView === 'agency' && rainRadarData ? (
            <RainRadarMap data={rainRadarData} />
          ) : activeLayer === 'PSI' && mapView === 'agency' && hazeLayerData ? (
            <HazeSatelliteMap data={hazeLayerData} />
          ) : (
            <SingaporeRegionMap
              markers={markers}
              heatmapLayer={heatmapLayer}
              weatherOverlay={weatherOverlay}
              showMarkers={false}
              emptyTitle={`Average ${activeLayer}`}
              emptyDetail={displayValue(activeLayer, average)}
              problemLabel={`${activeLayer.toLowerCase()} monitoring points`}
            />
          )}
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-400">
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
            activeLayer === 'Rainfall' ? 'bg-sky-400' : activeLayer === 'Temperature' ? 'bg-rose-400' : activeLayer === 'Wind' ? 'bg-cyan-300' : 'bg-orange-300'
          }`} />
          {activeLayer === 'Rainfall' && mapView === 'agency' && rainRadarData
            ? 'Official NEA Singapore rain radar imagery. Use Play radar or the timeline to inspect recent five-minute frames.'
            : activeLayer === 'PSI' && mapView === 'agency' && hazeLayerData
              ? 'Official NEA infrared satellite imagery with an optional regional wind overlay. PSI readings remain available in the charts below.'
              : activeLayer === 'Rainfall'
                ? 'Interactive Singapore map with measured rainfall intensity interpolated between official stations.'
                : activeLayer === 'PSI'
                  ? 'Interactive Singapore PSI surface using the five official regional readings and animated haze bands.'
                  : agencyMapNote(activeLayer, sorted[0]?.value ?? 0)}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 lg:col-span-2">
          <h2 className="mb-1 text-lg font-semibold">Highest Published Readings</h2>
          <p className="mb-4 text-xs text-zinc-500">Top stations or regions in this snapshot - average {displayValue(activeLayer, average)}</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sorted.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={75} />
              <YAxis stroke="#71717a" />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} name={`${activeLayer} (${displayUnit(activeLayer)})`} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">Reading Summary</h2>
          <dl className="space-y-4 text-sm">
            <div><dt className="text-zinc-500">Layer</dt><dd className="font-medium">{activeLayer}</dd></div>
            <div><dt className="text-zinc-500">Reporting locations</dt><dd className="font-medium">{current.rows.length}</dd></div>
            <div><dt className="text-zinc-500">Highest reading</dt><dd className="font-medium">{displayValue(activeLayer, sorted[0]?.value ?? 0)}</dd></div>
            <div><dt className="text-zinc-500">Average reading</dt><dd className="font-medium">{displayValue(activeLayer, average)}</dd></div>
          </dl>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Droplets className="h-5 w-5 text-blue-500" />
            24-Hour Rainfall Readings
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={rainfallChartData}>
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
            24-Hour Air Quality Trend (PSI)
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={psiChartData}>
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
