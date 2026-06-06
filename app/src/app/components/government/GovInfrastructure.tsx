import { Zap, Wifi, AlertTriangle, CheckCircle } from 'lucide-react';

const infrastructureStatus = [
  { name: 'Power Grid - North', status: 'operational', load: 78 },
  { name: 'Power Grid - South', status: 'operational', load: 84 },
  { name: 'Power Grid - East', status: 'warning', load: 92 },
  { name: 'Power Grid - West', status: 'operational', load: 76 },
  { name: 'Telecom Network - 5G', status: 'operational', uptime: 99.8 },
  { name: 'Telecom Network - 4G', status: 'operational', uptime: 99.9 },
  { name: 'Internet Exchange', status: 'operational', latency: 12 },
  { name: 'Public Transport System', status: 'operational', disruptions: 0 },
];

export default function GovInfrastructure() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Infrastructure Monitoring</h1>
        <p className="text-zinc-400">Critical infrastructure health and resilience tracking</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-950 rounded-lg">
              <Zap className="w-5 h-5 text-green-500" />
            </div>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold mb-1">99.2%</div>
          <div className="text-sm text-zinc-400">Power Grid Uptime</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-950 rounded-lg">
              <Wifi className="w-5 h-5 text-blue-500" />
            </div>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold mb-1">99.8%</div>
          <div className="text-sm text-zinc-400">Network Availability</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-yellow-950 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
            </div>
            <span className="text-xs px-2 py-1 bg-yellow-950 text-yellow-400 rounded">Monitor</span>
          </div>
          <div className="text-2xl font-bold mb-1">92%</div>
          <div className="text-sm text-zinc-400">Peak Grid Load (East)</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-950 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold mb-1">0</div>
          <div className="text-sm text-zinc-400">Active Disruptions</div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Infrastructure Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {infrastructureStatus.map((item) => (
            <div
              key={item.name}
              className={`p-4 rounded-lg border ${
                item.status === 'operational'
                  ? 'bg-green-950/20 border-green-800/50'
                  : 'bg-yellow-950/20 border-yellow-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{item.name}</span>
                {item.status === 'operational' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                )}
              </div>
              <div className="text-sm text-zinc-400">
                {'load' in item && `Load: ${item.load}%`}
                {'uptime' in item && `Uptime: ${item.uptime}%`}
                {'latency' in item && `Latency: ${item.latency}ms`}
                {'disruptions' in item && `Disruptions: ${item.disruptions}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-yellow-950/30 border border-yellow-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-yellow-500 mt-1" />
          <div>
            <h3 className="font-semibold mb-2">East Region Power Grid Warning</h3>
            <p className="text-sm text-zinc-300">
              Power grid load in eastern region approaching critical threshold. Recommend load balancing and backup generator activation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
