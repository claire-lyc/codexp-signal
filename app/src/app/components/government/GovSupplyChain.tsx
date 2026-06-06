// GET /api/crises/{crisisId}/summary
// GET /api/crises/{crisisId}/metrics
// GET /api/heatmap?crisisId=supply&layer=shortage
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Package, Ship, AlertCircle, TrendingDown, TrendingUp, ChevronDown, MapPin, Clock, Zap } from 'lucide-react';

const crisisOptions = [
  { id: 'panadol', label: 'Panadol Menstrual Shortage', severity: 'medium', badge: 'bg-yellow-900 text-yellow-400', border: 'border-yellow-700' },
  { id: 'general', label: 'General Supply Overview', severity: 'low', badge: 'bg-blue-900 text-blue-400', border: 'border-blue-700' },
];

const panadolData = {
  description: 'Islandwide shortage of Panadol Menstrual due to manufacturing disruption at primary supplier. Emergency procurement underway.',
  stats: [
    { label: 'Outlets Out of Stock', value: '87', delta: '+14 today', icon: 'red' },
    { label: 'Affected Regions', value: '5 / 6', delta: '', icon: 'orange' },
    { label: 'Est. Restock (days)', value: '4', delta: '-1 day', icon: 'green' },
    { label: 'Alt. Suppliers Found', value: '2', delta: '+2', icon: 'blue' },
  ],
  affectedLocations: [
    { name: 'Jurong West Cluster', stores: 18, region: 'West', severity: 'high' },
    { name: 'Tampines Hub Area', stores: 15, region: 'East', severity: 'high' },
    { name: 'Ang Mo Kio Hub', stores: 12, region: 'North', severity: 'medium' },
    { name: 'Orchard / Dhoby', stores: 22, region: 'Central', severity: 'medium' },
    { name: 'Woodlands Crescent', stores: 10, region: 'North', severity: 'low' },
    { name: 'Toa Payoh Central', stores: 10, region: 'Central', severity: 'low' },
  ],
  response: [
    { action: 'Contact Haleon (alt supplier — Malaysia)', status: 'done' },
    { action: 'Contact Pharmaniaga (alt supplier — regional)', status: 'done' },
    { action: 'Activate strategic health stockpile (MOH)', status: 'pending' },
    { action: 'Issue public advisory on alternatives', status: 'pending' },
    { action: 'Coordinate distribution to priority outlets', status: 'pending' },
  ],
  pins: [
    { label: 'Jurong West', x: 18, y: 50, severity: 'high' },
    { label: 'Tampines', x: 73, y: 43, severity: 'high' },
    { label: 'Ang Mo Kio', x: 48, y: 28, severity: 'medium' },
    { label: 'Orchard', x: 43, y: 42, severity: 'medium' },
    { label: 'Woodlands', x: 38, y: 12, severity: 'low' },
    { label: 'Toa Payoh', x: 47, y: 35, severity: 'low' },
  ],
};

const generalStockData = [
  { item: 'Rice', stock: 94, change: -2 },
  { item: 'Vegetables', stock: 87, change: 3 },
  { item: 'Meat', stock: 91, change: -1 },
  { item: 'Medicine', stock: 68, change: -8 },
  { item: 'Fuel', stock: 98, change: 2 },
];

const pinColors: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

const statusColors: Record<string, string> = {
  done: 'bg-green-950/40 border-green-800 text-green-400',
  pending: 'bg-yellow-950/40 border-yellow-800 text-yellow-400',
};

const iconBg: Record<string, string> = {
  red: 'bg-red-950 text-red-500',
  orange: 'bg-orange-950 text-orange-500',
  green: 'bg-green-950 text-green-500',
  blue: 'bg-blue-950 text-blue-500',
  yellow: 'bg-yellow-950 text-yellow-500',
};

export default function GovSupplyChain() {
  const [selectedCrisis, setSelectedCrisis] = useState('panadol');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const crisis = crisisOptions.find((c) => c.id === selectedCrisis)!;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Supply Chain Monitoring</h1>
          <p className="text-zinc-400">Critical resource tracking, shortage alerts, and import dependency analysis</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className={`flex items-center gap-2 px-4 py-2 bg-zinc-800 border ${crisis.border} rounded-lg text-sm hover:bg-zinc-700 transition-colors`}
          >
            <span className="text-white">{crisis.label}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${crisis.badge}`}>{crisis.severity.toUpperCase()}</span>
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 mt-1 w-64 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-20">
              {crisisOptions.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCrisis(c.id); setDropdownOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-zinc-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${selectedCrisis === c.id ? 'bg-zinc-700' : ''}`}
                >
                  <span>{c.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${c.badge}`}>{c.severity.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedCrisis === 'panadol' ? (
        <>
          {/* Shortage alert banner */}
          <div className="bg-yellow-950/30 border border-yellow-700 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold text-yellow-300 mb-1">Active Supply Crisis: Panadol Menstrual</div>
                <p className="text-sm text-zinc-300">{panadolData.description}</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {panadolData.stats.map((s, i) => {
              const [bg, text] = iconBg[s.icon].split(' ');
              return (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 ${bg} rounded-lg`}>
                      <Package className={`w-5 h-5 ${text}`} />
                    </div>
                    {s.delta && <span className="text-xs text-zinc-400">{s.delta}</span>}
                  </div>
                  <div className="text-2xl font-bold mb-1">{s.value}</div>
                  <div className="text-sm text-zinc-400">{s.label}</div>
                </div>
              );
            })}
          </div>

          {/* Heatmap — GET /api/heatmap?crisisId=supply&layer=shortage */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="w-5 h-5 text-yellow-500" />
                Shortage Location Map — Panadol Menstrual
              </h2>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500" />Critical</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-500" />Moderate</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500" />Minor</span>
              </div>
            </div>
            <div className="relative bg-zinc-800 rounded-lg overflow-hidden" style={{ paddingBottom: '46%' }}>
              <div className="absolute inset-0">
                <svg viewBox="0 0 100 46" className="w-full h-full opacity-10" fill="none">
                  <path d="M5,18 Q15,8 30,6 Q50,3 70,10 Q85,14 95,18 Q90,30 80,36 Q65,42 50,42 Q35,42 20,36 Q8,28 5,18Z" fill="#eab308" />
                </svg>
                {panadolData.pins.map((pin) => (
                  <div
                    key={pin.label}
                    className="absolute group"
                    style={{ left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%,-50%)' }}
                  >
                    <div className={`w-5 h-5 rounded-full ${pinColors[pin.severity]} border-2 border-white/30 animate-pulse cursor-pointer`} />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                      <div className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs whitespace-nowrap">{pin.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Affected locations + Response actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Affected Store Clusters</h2>
              <div className="space-y-3">
                {panadolData.affectedLocations.map((loc) => (
                  <div
                    key={loc.name}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      loc.severity === 'high' ? 'bg-red-950/30 border-red-800' :
                      loc.severity === 'medium' ? 'bg-yellow-950/30 border-yellow-800' :
                      'bg-blue-950/30 border-blue-800'
                    }`}
                  >
                    <div>
                      <div className="font-medium text-sm">{loc.name}</div>
                      <div className="text-xs text-zinc-400">{loc.region} region</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{loc.stores}</div>
                      <div className="text-xs text-zinc-500">outlets</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Recommended Response Actions
              </h2>
              <div className="space-y-2 mb-6">
                {panadolData.response.map((r, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${statusColors[r.status]}`}>
                    <span className="text-sm">{r.action}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${r.status === 'done' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
                      {r.status === 'done' ? 'Done' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Clock className="w-4 h-4" />
                <span>Estimated full restock: 4 days — Subject to procurement outcome</span>
              </div>
            </div>
          </div>

          {/* Data projection */}
          <div className="bg-gradient-to-r from-yellow-950/50 to-orange-950/50 border border-yellow-900/50 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-yellow-900/50 rounded-lg"><AlertCircle className="w-6 h-6 text-yellow-400" /></div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Data Projection — Panadol Shortage</h3>
                <p className="text-sm text-zinc-300 mb-3">
                  If alternate supplier procurement proceeds, full restock expected within 4 days. Without intervention, shortage will escalate to additional medical supplies within 2 weeks. Recommend immediate distribution of strategic stockpile to high-severity zones.
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-zinc-800 rounded">Confidence: 88%</span>
                  <span className="px-2 py-1 bg-zinc-800 rounded">Risk Timeline: 4–14 days</span>
                  <span className="px-2 py-1 bg-red-900 text-red-400 rounded">Action Required: Immediate</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* General overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="p-2 bg-green-950 rounded-lg mb-3 inline-block"><Package className="w-5 h-5 text-green-500" /></div>
              <div className="text-2xl font-bold mb-1">91%</div>
              <div className="text-sm text-zinc-400">Overall Supply Health</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="p-2 bg-blue-950 rounded-lg mb-3 inline-block"><Ship className="w-5 h-5 text-blue-500" /></div>
              <div className="text-2xl font-bold mb-1">47</div>
              <div className="text-sm text-zinc-400">Incoming Shipments</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="p-2 bg-yellow-950 rounded-lg mb-3 inline-block"><AlertCircle className="w-5 h-5 text-yellow-500" /></div>
              <div className="text-2xl font-bold mb-1">68%</div>
              <div className="text-sm text-zinc-400">Medicine Stock Level</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="p-2 bg-red-950 rounded-lg mb-3 inline-block"><Ship className="w-5 h-5 text-red-500" /></div>
              <div className="text-2xl font-bold mb-1">68%</div>
              <div className="text-sm text-zinc-400">Port Capacity Utilization</div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Critical Resource Stock Levels</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={generalStockData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="item" stroke="#71717a" />
                <YAxis stroke="#71717a" />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }} />
                <Bar dataKey="stock" fill="#dc2626" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Import Dependency</h2>
            <div className="space-y-4">
              {generalStockData.map((item) => (
                <div key={item.item}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">{item.item}</span>
                    <div className="flex items-center gap-2">
                      {item.change >= 0 ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                      <span className={`text-sm ${item.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>{item.change > 0 ? '+' : ''}{item.change}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2">
                    <div className={`h-2 rounded-full ${item.stock >= 90 ? 'bg-green-600' : item.stock >= 80 ? 'bg-yellow-600' : 'bg-red-600'}`} style={{ width: `${item.stock}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
