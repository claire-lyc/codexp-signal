// GET /api/crises/{crisisId}/summary
// GET /api/crises/{crisisId}/metrics
// GET /api/heatmap?crisisId=&layer=clusters
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, TrendingUp, Users, Package, MapPin, AlertTriangle, ChevronDown } from 'lucide-react';

const crisisOptions = [
  { id: 'covid', label: 'Covid-19', severity: 'medium', color: 'text-orange-400', badge: 'bg-orange-900 text-orange-400', border: 'border-orange-700' },
  { id: 'dengue', label: 'Dengue', severity: 'high', color: 'text-red-400', badge: 'bg-red-900 text-red-400', border: 'border-red-700' },
  { id: 'hantavirus', label: 'Hantavirus', severity: 'low', color: 'text-blue-400', badge: 'bg-blue-900 text-blue-400', border: 'border-blue-700' },
];

const crisisData: Record<string, {
  stats: { label: string; value: string; delta?: string; icon: string }[];
  clusters: { name: string; cases: number; severity: string }[];
  trendData: { date: string; cases: number; icu: number }[];
  ppeStock: { item: string; stock: number; status: string }[];
  description: string;
}> = {
  covid: {
    description: 'Covid-19 — Traffic light severity system applies. Green < 50 cases/day, Yellow 50–200, Red 200+.',
    stats: [
      { label: 'New Cases (24h)', value: '378', delta: '+12%', icon: 'red' },
      { label: 'ICU Occupancy', value: '25', delta: '+5', icon: 'orange' },
      { label: 'Vaccination Rate', value: '92%', delta: '+0.2%', icon: 'green' },
      { label: 'Avg PPE Stock', value: '65%', delta: 'Alert', icon: 'yellow' },
    ],
    clusters: [
      { name: 'Jurong West MRT', cases: 45, severity: 'high' },
      { name: 'Ang Mo Kio Hub', cases: 32, severity: 'medium' },
      { name: 'Tampines Mall', cases: 28, severity: 'medium' },
      { name: 'Woodlands Ctr', cases: 18, severity: 'low' },
    ],
    trendData: [
      { date: 'May 13', cases: 245, icu: 12 },
      { date: 'May 14', cases: 289, icu: 15 },
      { date: 'May 15', cases: 312, icu: 18 },
      { date: 'May 16', cases: 298, icu: 16 },
      { date: 'May 17', cases: 334, icu: 20 },
      { date: 'May 18', cases: 356, icu: 23 },
      { date: 'May 19', cases: 378, icu: 25 },
    ],
    ppeStock: [
      { item: 'N95 Masks', stock: 78, status: 'good' },
      { item: 'Surgical Masks', stock: 92, status: 'good' },
      { item: 'Gloves', stock: 65, status: 'medium' },
      { item: 'Gowns', stock: 45, status: 'low' },
      { item: 'Face Shields', stock: 88, status: 'good' },
    ],
  },
  dengue: {
    description: 'Dengue — Colour-coded zones: Red (>10 cases/cluster), Yellow (5–10), Green (<5).',
    stats: [
      { label: 'Red Zones', value: '14', delta: '+3', icon: 'red' },
      { label: 'Cases This Week', value: '212', delta: '+8%', icon: 'orange' },
      { label: 'Treated / Recovered', value: '87%', delta: '', icon: 'green' },
      { label: 'Active Clusters', value: '22', delta: '+2', icon: 'yellow' },
    ],
    clusters: [
      { name: 'Bedok North Ave 1', cases: 23, severity: 'high' },
      { name: 'Pasir Ris Dr 3', cases: 17, severity: 'high' },
      { name: 'Yishun Ring Rd', cases: 11, severity: 'medium' },
      { name: 'Bukit Timah Rd', cases: 6, severity: 'low' },
    ],
    trendData: [
      { date: 'May 13', cases: 150, icu: 3 },
      { date: 'May 14', cases: 165, icu: 4 },
      { date: 'May 15', cases: 180, icu: 5 },
      { date: 'May 16', cases: 175, icu: 5 },
      { date: 'May 17', cases: 190, icu: 6 },
      { date: 'May 18', cases: 200, icu: 7 },
      { date: 'May 19', cases: 212, icu: 8 },
    ],
    ppeStock: [
      { item: 'Repellent Stock', stock: 72, status: 'medium' },
      { item: 'Larvicide', stock: 58, status: 'low' },
      { item: 'Blood Test Kits', stock: 85, status: 'good' },
    ],
  },
  hantavirus: {
    description: 'Hantavirus — Low incidence. Monitoring rodent-exposed populations in affected areas.',
    stats: [
      { label: 'Confirmed Cases', value: '4', delta: '', icon: 'red' },
      { label: 'Under Observation', value: '18', delta: '+3', icon: 'orange' },
      { label: 'Recovered', value: '2', delta: '', icon: 'green' },
      { label: 'Risk Zones', value: '3', delta: '', icon: 'yellow' },
    ],
    clusters: [
      { name: 'Lim Chu Kang Rd', cases: 2, severity: 'medium' },
      { name: 'Seletar Area', cases: 1, severity: 'low' },
      { name: 'Choa Chu Kang', cases: 1, severity: 'low' },
    ],
    trendData: [
      { date: 'May 13', cases: 1, icu: 0 },
      { date: 'May 14', cases: 1, icu: 0 },
      { date: 'May 15', cases: 2, icu: 1 },
      { date: 'May 16', cases: 2, icu: 1 },
      { date: 'May 17', cases: 3, icu: 1 },
      { date: 'May 18', cases: 3, icu: 1 },
      { date: 'May 19', cases: 4, icu: 1 },
    ],
    ppeStock: [
      { item: 'Protective Suits', stock: 92, status: 'good' },
      { item: 'Ribavirin Stock', stock: 88, status: 'good' },
    ],
  },
};

const clusterPins = [
  { label: 'Jurong West', x: 20, y: 48, severity: 'high' },
  { label: 'Ang Mo Kio', x: 48, y: 28, severity: 'medium' },
  { label: 'Tampines', x: 73, y: 43, severity: 'medium' },
  { label: 'Woodlands', x: 38, y: 12, severity: 'low' },
  { label: 'Bedok', x: 76, y: 56, severity: 'high' },
  { label: 'Seletar', x: 55, y: 20, severity: 'low' },
];

const pinColor: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const severityColors: Record<string, string> = {
  high: 'bg-red-950/30 border-red-800',
  medium: 'bg-yellow-950/30 border-yellow-800',
  low: 'bg-blue-950/30 border-blue-800',
};

const iconColors: Record<string, string> = {
  red: 'bg-red-950',
  orange: 'bg-orange-950',
  green: 'bg-green-950',
  yellow: 'bg-yellow-950',
};

export default function GovPandemic() {
  const [selectedCrisis, setSelectedCrisis] = useState('covid');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const crisis = crisisOptions.find((c) => c.id === selectedCrisis)!;
  const data = crisisData[selectedCrisis];

  return (
    <div className="space-y-6">
      {/* Header with crisis selector */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Health / Diseases</h1>
          <p className="text-zinc-400">Real-time monitoring and healthcare coordination by disease type</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className={`flex items-center gap-2 px-4 py-2 bg-zinc-800 border ${crisis.border} rounded-lg text-sm hover:bg-zinc-700 transition-colors`}
          >
            <span className={crisis.color}>{crisis.label}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${crisis.badge}`}>{crisis.severity.toUpperCase()}</span>
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 mt-1 w-52 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-20">
              {crisisOptions.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCrisis(c.id); setDropdownOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-zinc-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${selectedCrisis === c.id ? 'bg-zinc-700' : ''}`}
                >
                  <span className={c.color}>{c.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${c.badge}`}>{c.severity.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Severity description */}
      <div className={`px-4 py-3 rounded-lg border text-sm ${crisis.id === 'dengue' ? 'bg-red-950/20 border-red-800 text-red-300' : crisis.id === 'covid' ? 'bg-yellow-950/20 border-yellow-800 text-yellow-300' : 'bg-blue-950/20 border-blue-800 text-blue-300'}`}>
        <AlertTriangle className="w-4 h-4 inline mr-2 opacity-70" />
        {data.description}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.stats.map((stat, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 ${iconColors[stat.icon]} rounded-lg`}>
                <Activity className={`w-5 h-5 text-${stat.icon}-500`} />
              </div>
              {stat.delta && (
                <span className={`text-xs ${stat.delta.includes('+') ? 'text-red-400' : 'text-zinc-400'}`}>{stat.delta}</span>
              )}
            </div>
            <div className="text-2xl font-bold mb-1">{stat.value}</div>
            <div className="text-sm text-zinc-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Heatmap — GET /api/heatmap?crisisId=&layer=clusters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-red-600" />
            Active Cluster Map — {crisis.label}
          </h2>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500" />High</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-yellow-500" />Medium</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-500" />Low</div>
          </div>
        </div>
        <div className="relative bg-zinc-800 rounded-lg overflow-hidden" style={{ paddingBottom: '45%' }}>
          <div className="absolute inset-0">
            {/* Singapore shape overlay */}
            <svg viewBox="0 0 100 45" className="w-full h-full opacity-10" fill="none">
              <path d="M5,18 Q15,8 30,6 Q50,3 70,10 Q85,14 95,18 Q90,30 80,37 Q65,43 50,43 Q35,43 20,37 Q8,30 5,18Z" fill="#dc2626" />
            </svg>
            {/* Cluster pins */}
            {clusterPins.map((pin) => (
              <div
                key={pin.label}
                className="absolute group"
                style={{ left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -50%)' }}
              >
                <div className={`w-5 h-5 rounded-full ${pinColor[pin.severity]} border-2 border-white/40 animate-pulse cursor-pointer`} />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                  <div className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs whitespace-nowrap">
                    <span className="font-medium">{pin.label}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-zinc-500 mt-2">Pin locations represent active clusters. Hover for details. Overcrowded hospitals and vaccination centres are highlighted.</p>
      </div>

      {/* Trend chart + Active Clusters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          {/* GET /api/crises/{crisisId}/metrics */}
          <h2 className="text-lg font-semibold mb-4">Case Trends & ICU Capacity</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" />
              <YAxis stroke="#71717a" />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="cases" stroke="#dc2626" strokeWidth={2} name="Daily Cases" />
              <Line type="monotone" dataKey="icu" stroke="#f97316" strokeWidth={2} name="ICU Patients" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-3 text-sm">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-600 rounded" /><span className="text-zinc-400">Daily Cases</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-600 rounded" /><span className="text-zinc-400">ICU Patients</span></div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Active Clusters</h2>
          <div className="space-y-3">
            {data.clusters.map((cluster) => (
              <div key={cluster.name} className={`p-4 rounded-lg border ${severityColors[cluster.severity]}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-zinc-400" />
                    <span className="font-medium text-sm">{cluster.name}</span>
                  </div>
                  <span className="text-xl font-bold">{cluster.cases}</span>
                </div>
                <div className="text-xs text-zinc-400">Active cases in cluster</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PPE / resource stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Resource Stock Levels</h2>
          <div className="space-y-4">
            {data.ppeStock.map((item) => (
              <div key={item.item}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">{item.item}</span>
                  <span className="text-sm font-semibold">{item.stock}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${item.status === 'good' ? 'bg-green-600' : item.status === 'medium' ? 'bg-yellow-600' : 'bg-red-600'}`}
                    style={{ width: `${item.stock}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-950/50 to-blue-950/50 border border-purple-900/50 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-900/50 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Data Projection — {crisis.label}</h3>
              <p className="text-sm text-zinc-300 mb-3">
                {selectedCrisis === 'covid'
                  ? 'Model projects 15–20% case increase over next 5 days based on cluster growth and mobility data. Recommend preemptive hospital capacity expansion in western region.'
                  : selectedCrisis === 'dengue'
                  ? 'Dengue cluster expansion expected in eastern zones. Recommend targeted fogging operations and community outreach in Bedok and Pasir Ris.'
                  : 'Hantavirus risk remains contained. Monitor Lim Chu Kang rodent population. No community spread detected.'}
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Confidence Level</span>
                  <span className="px-2 py-1 bg-zinc-800 rounded">{selectedCrisis === 'covid' ? '84%' : selectedCrisis === 'dengue' ? '79%' : '91%'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Data Sources</span>
                  <span className="px-2 py-1 bg-zinc-800 rounded">{selectedCrisis === 'dengue' ? 'NEA, MOH, LTA' : 'MOH, Trace Together'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Human Verification</span>
                  <span className="px-2 py-1 bg-yellow-900 text-yellow-400 rounded">Required</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
