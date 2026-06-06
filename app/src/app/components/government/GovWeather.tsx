// GET /api/heatmap?crisisId=weather&layer=
// GET /api/crises/{crisisId}/metrics
import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Cloud, Droplets, Wind, AlertTriangle, ThermometerSun, Layers, MapPin } from 'lucide-react';

const rainfallData = [
  { time: '00:00', value: 2 },
  { time: '04:00', value: 5 },
  { time: '08:00', value: 12 },
  { time: '12:00', value: 28 },
  { time: '16:00', value: 45 },
  { time: '20:00', value: 32 },
  { time: '23:59', value: 18 },
];

const tempData = [
  { time: '00:00', value: 26 },
  { time: '04:00', value: 24 },
  { time: '08:00', value: 28 },
  { time: '12:00', value: 33 },
  { time: '16:00', value: 34 },
  { time: '20:00', value: 30 },
  { time: '23:59', value: 27 },
];

const aqiData = [
  { time: '00:00', value: 98 },
  { time: '04:00', value: 102 },
  { time: '08:00', value: 118 },
  { time: '12:00', value: 134 },
  { time: '16:00', value: 156 },
  { time: '20:00', value: 142 },
  { time: '23:59', value: 128 },
];

const windData = [
  { time: '00:00', value: 10 },
  { time: '04:00', value: 8 },
  { time: '08:00', value: 12 },
  { time: '12:00', value: 18 },
  { time: '16:00', value: 22 },
  { time: '20:00', value: 15 },
  { time: '23:59', value: 11 },
];

const floodData = [
  { time: '00:00', value: 15 },
  { time: '04:00', value: 18 },
  { time: '08:00', value: 32 },
  { time: '12:00', value: 58 },
  { time: '16:00', value: 74 },
  { time: '20:00', value: 62 },
  { time: '23:59', value: 45 },
];

type LayerKey = 'Rainfall' | 'Temperature' | 'AQI' | 'Wind' | 'Flood Risk';

const layerConfigs: Record<LayerKey, {
  color: string;
  unit: string;
  data: typeof rainfallData;
  gradId: string;
  zones: { label: string; x: number; y: number; value: string; severity: string }[];
}> = {
  Rainfall: {
    color: '#3b82f6',
    unit: 'mm/h',
    data: rainfallData,
    gradId: 'rainGrad',
    zones: [
      { label: 'Orchard', x: 42, y: 42, value: '28mm', severity: 'medium' },
      { label: 'East Coast', x: 72, y: 56, value: '45mm', severity: 'high' },
      { label: 'Jurong', x: 20, y: 48, value: '18mm', severity: 'low' },
      { label: 'Woodlands', x: 38, y: 12, value: '22mm', severity: 'medium' },
      { label: 'Punggol', x: 63, y: 22, value: '12mm', severity: 'low' },
    ],
  },
  Temperature: {
    color: '#f97316',
    unit: '°C',
    data: tempData,
    gradId: 'tempGrad',
    zones: [
      { label: 'Central', x: 45, y: 38, value: '34°C', severity: 'high' },
      { label: 'Jurong', x: 20, y: 48, value: '33°C', severity: 'medium' },
      { label: 'North', x: 35, y: 20, value: '32°C', severity: 'medium' },
      { label: 'East', x: 72, y: 42, value: '33.5°C', severity: 'high' },
      { label: 'South', x: 47, y: 65, value: '31°C', severity: 'low' },
    ],
  },
  AQI: {
    color: '#a855f7',
    unit: 'PSI',
    data: aqiData,
    gradId: 'aqiGrad',
    zones: [
      { label: 'Central', x: 45, y: 38, value: '156', severity: 'high' },
      { label: 'West', x: 20, y: 48, value: '134', severity: 'medium' },
      { label: 'East', x: 72, y: 42, value: '142', severity: 'medium' },
      { label: 'North', x: 35, y: 20, value: '118', severity: 'low' },
    ],
  },
  Wind: {
    color: '#22c55e',
    unit: 'km/h',
    data: windData,
    gradId: 'windGrad',
    zones: [
      { label: 'Marina Bay', x: 50, y: 55, value: '22km/h', severity: 'medium' },
      { label: 'East', x: 72, y: 42, value: '18km/h', severity: 'low' },
      { label: 'Jurong', x: 20, y: 48, value: '15km/h', severity: 'low' },
    ],
  },
  'Flood Risk': {
    color: '#dc2626',
    unit: '% risk',
    data: floodData,
    gradId: 'floodGrad',
    zones: [
      { label: 'Orchard', x: 42, y: 42, value: '74%', severity: 'high' },
      { label: 'Marina Bay', x: 50, y: 55, value: '62%', severity: 'high' },
      { label: 'East Coast', x: 72, y: 56, value: '58%', severity: 'high' },
      { label: 'Jurong', x: 20, y: 48, value: '32%', severity: 'medium' },
      { label: 'Woodlands', x: 38, y: 12, value: '18%', severity: 'low' },
    ],
  },
};

const pinColors: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const layers: LayerKey[] = ['Rainfall', 'Temperature', 'AQI', 'Wind', 'Flood Risk'];

export default function GovWeather() {
  const [activeLayer, setActiveLayer] = useState<LayerKey>('Rainfall');
  const cfg = layerConfigs[activeLayer];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Weather & Climate Monitoring</h1>
        <p className="text-zinc-400">Environmental conditions and climate risk assessment across Singapore</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-orange-950 rounded-lg"><Cloud className="w-5 h-5 text-orange-500" /></div>
            <span className="text-xs px-2 py-1 bg-orange-950 text-orange-400 rounded">Unhealthy</span>
          </div>
          <div className="text-2xl font-bold mb-1">156</div>
          <div className="text-sm text-zinc-400">PSI (Air Quality)</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-950 rounded-lg"><Droplets className="w-5 h-5 text-blue-500" /></div>
            <span className="text-xs px-2 py-1 bg-red-950 text-red-400 rounded">Alert</span>
          </div>
          <div className="text-2xl font-bold mb-1">45mm</div>
          <div className="text-sm text-zinc-400">Peak Rainfall (1h)</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-red-950 rounded-lg"><ThermometerSun className="w-5 h-5 text-red-500" /></div>
            <span className="text-xs px-2 py-1 bg-yellow-950 text-yellow-400 rounded">High</span>
          </div>
          <div className="text-2xl font-bold mb-1">34°C</div>
          <div className="text-sm text-zinc-400">Heat Stress Index</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-950 rounded-lg"><Wind className="w-5 h-5 text-purple-500" /></div>
            <span className="text-xs px-2 py-1 bg-green-950 text-green-400 rounded">Normal</span>
          </div>
          <div className="text-2xl font-bold mb-1">15 km/h</div>
          <div className="text-sm text-zinc-400">Wind Speed</div>
        </div>
      </div>

      {/* Heatmap with layer toggles — GET /api/heatmap?crisisId=weather&layer= */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-500" />
            Singapore Weather Heatmap
          </h2>
          <div className="flex gap-1.5 flex-wrap justify-end">
            {layers.map((l) => (
              <button
                key={l}
                onClick={() => setActiveLayer(l)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeLayer === l ? 'text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                style={activeLayer === l ? { backgroundColor: cfg.color } : {}}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Map SVG with data pins */}
        <div className="relative bg-zinc-800 rounded-lg overflow-hidden" style={{ paddingBottom: '48%' }}>
          <div className="absolute inset-0">
            {/* Singapore shape — colour tinted by layer */}
            <svg viewBox="0 0 100 48" className="w-full h-full" fill="none">
              <defs>
                <radialGradient id="mapHeat" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor={cfg.color} stopOpacity="0.45" />
                  <stop offset="60%" stopColor={cfg.color} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={cfg.color} stopOpacity="0.05" />
                </radialGradient>
              </defs>
              <path d="M5,18 Q15,8 30,6 Q50,3 70,10 Q85,14 95,18 Q90,30 80,36 Q65,43 50,43 Q35,43 20,37 Q8,30 5,18Z" fill="url(#mapHeat)" stroke={cfg.color} strokeWidth="0.3" strokeOpacity="0.4" />
              {/* Contour lines */}
              <path d="M15,20 Q30,14 50,14 Q70,14 85,20 Q80,28 65,33 Q50,37 35,33 Q20,28 15,20Z" fill="none" stroke={cfg.color} strokeWidth="0.2" strokeOpacity="0.3" strokeDasharray="1,1" />
            </svg>
            {/* Data pins */}
            {cfg.zones.map((zone) => (
              <div
                key={zone.label}
                className="absolute group cursor-pointer"
                style={{ left: `${zone.x}%`, top: `${zone.y}%`, transform: 'translate(-50%,-50%)' }}
              >
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold border border-white/20 ${zone.severity === 'high' ? 'bg-zinc-900/90 text-red-400' : zone.severity === 'medium' ? 'bg-zinc-900/90 text-yellow-400' : 'bg-zinc-900/90 text-green-400'}`}>
                  {zone.value}
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                  <div className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs whitespace-nowrap">{zone.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 text-xs text-zinc-500">
          <span>Active layer: <span className="font-medium" style={{ color: cfg.color }}>{activeLayer}</span> — unit: {cfg.unit}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500" />High</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-500" />Medium</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500" />Low</span>
          </div>
        </div>
      </div>

      {/* Charts below heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-500" />
            24-Hour Rainfall Forecast
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={rainfallData}>
              <defs>
                <linearGradient id="rainfallGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="time" stroke="#71717a" />
              <YAxis stroke="#71717a" label={{ value: 'mm', angle: -90, position: 'insideLeft', style: { fill: '#71717a' } }} />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#rainfallGradient)" name="Rainfall (mm)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Cloud className="w-5 h-5 text-orange-500" />
            Air Quality Trend (PSI)
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={aqiData}>
              <defs>
                <linearGradient id="psiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="time" stroke="#71717a" />
              <YAxis stroke="#71717a" />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="value" stroke="#f97316" fill="url(#psiGradient)" name="PSI" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk advisories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-red-950/30 border border-red-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="font-semibold">Flood Risk Alert</h3>
          </div>
          <p className="text-sm text-zinc-300 mb-3">High risk of flash floods in Orchard, Marina Bay, and East Coast due to predicted heavy rainfall.</p>
          <div className="text-xs text-zinc-400">Risk Level: HIGH • Updated: 2 mins ago</div>
        </div>
        <div className="bg-orange-950/30 border border-orange-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Cloud className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold">Haze Advisory</h3>
          </div>
          <p className="text-sm text-zinc-300 mb-3">PSI levels elevated due to regional forest fires. Vulnerable groups advised to stay indoors.</p>
          <div className="text-xs text-zinc-400">Risk Level: MEDIUM • Updated: 15 mins ago</div>
        </div>
        <div className="bg-yellow-950/30 border border-yellow-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <ThermometerSun className="w-5 h-5 text-yellow-500" />
            <h3 className="font-semibold">Heat Warning</h3>
          </div>
          <p className="text-sm text-zinc-300 mb-3">Heat stress index forecasted to reach critical levels between 12pm–4pm. Public advisories issued.</p>
          <div className="text-xs text-zinc-400">Risk Level: MEDIUM • Updated: 1 hour ago</div>
        </div>
      </div>

      {/* AI / data projection */}
      <div className="bg-gradient-to-r from-blue-950/50 to-cyan-950/50 border border-blue-900/50 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-900/50 rounded-lg"><AlertTriangle className="w-6 h-6 text-blue-400" /></div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Data Projection — Weather Analysis</h3>
            <p className="text-sm text-zinc-300 mb-3">
              Pattern analysis indicates sustained heavy rainfall probability of 78% in next 6 hours. Recommend activating flood response protocols in identified high-risk zones and issuing public transport advisories.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="px-2 py-1 bg-zinc-800 rounded">Confidence: 78%</span>
              <span className="px-2 py-1 bg-zinc-800 rounded">Source: Meteorological Service Singapore</span>
              <span className="px-2 py-1 bg-yellow-900 text-yellow-400 rounded">Human Approval Required</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
