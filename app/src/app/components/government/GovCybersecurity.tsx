import { Shield, AlertTriangle, CheckCircle, Globe } from 'lucide-react';
import { useApi } from '../../lib/api';

type CybersecurityData = {
  metrics: Array<{ label: string; value: string; status: string; icon: string; colour: string }>;
  threats: Array<{ type: string; target: string; severity: string; status: string; time: string }>;
};

const iconMap = { Shield, AlertTriangle, Globe };
const colourMap: Record<string, string> = {
  green: 'text-green-500',
  red: 'text-red-500',
  blue: 'text-blue-500',
  purple: 'text-purple-500',
};
const bgMap: Record<string, string> = {
  green: 'bg-green-950',
  red: 'bg-red-950',
  blue: 'bg-blue-950',
  purple: 'bg-purple-950',
};

export default function GovCybersecurity() {
  const { data: cybersecurity, loading, error } = useApi<CybersecurityData>('/api/gov/cybersecurity');
  const threats = cybersecurity?.threats ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Cybersecurity Operations Centre</h1>
        <p className="text-zinc-400">Real-time cyber threat monitoring and incident response</p>
      </div>

      {loading && <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">Loading cybersecurity data...</div>}
      {error && <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">Cybersecurity API unavailable: {error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(cybersecurity?.metrics ?? []).map((metric) => {
          const Icon = iconMap[metric.icon as keyof typeof iconMap] ?? Shield;
          const colour = colourMap[metric.colour] ?? 'text-zinc-400';
          const bg = bgMap[metric.colour] ?? 'bg-zinc-800';

          return (
            <div key={metric.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 ${bg} rounded-lg`}>
                  <Icon className={`w-5 h-5 ${colour}`} />
                </div>
                {metric.status === 'ok' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <span className="text-xs px-2 py-1 bg-red-950 text-red-400 rounded">{metric.status}</span>
                )}
              </div>
              <div className="text-2xl font-bold mb-1">{metric.value}</div>
              <div className="text-sm text-zinc-400">{metric.label}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Threat Activity</h2>
        <div className="space-y-3">
          {threats.map((threat, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border ${
                threat.severity === 'high'
                  ? 'bg-red-950/30 border-red-800'
                  : threat.severity === 'medium'
                  ? 'bg-yellow-950/30 border-yellow-800'
                  : 'bg-blue-950/30 border-blue-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <AlertTriangle
                    className={`w-5 h-5 ${
                      threat.severity === 'high'
                        ? 'text-red-500'
                        : threat.severity === 'medium'
                        ? 'text-yellow-500'
                        : 'text-blue-500'
                    }`}
                  />
                  <div>
                    <div className="font-medium">{threat.type}</div>
                    <div className="text-sm text-zinc-400">Target: {threat.target}</div>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    threat.status === 'mitigated'
                      ? 'bg-green-950 text-green-400'
                      : threat.status === 'monitoring'
                      ? 'bg-yellow-950 text-yellow-400'
                      : 'bg-blue-950 text-blue-400'
                  }`}
                >
                  {threat.status.toUpperCase()}
                </span>
              </div>
              <div className="text-xs text-zinc-500">{threat.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
