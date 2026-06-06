import { Shield, AlertTriangle, CheckCircle, Globe } from 'lucide-react';

const threats = [
  { type: 'DDoS Attack', target: 'Gov Portal', severity: 'high', status: 'mitigated', time: '45 mins ago' },
  { type: 'Phishing Campaign', target: 'Healthcare System', severity: 'medium', status: 'monitoring', time: '2 hours ago' },
  { type: 'Malware Detection', target: 'Public Services', severity: 'low', status: 'resolved', time: '5 hours ago' },
];

export default function GovCybersecurity() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Cybersecurity Operations Centre</h1>
        <p className="text-zinc-400">Real-time cyber threat monitoring and incident response</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-950 rounded-lg">
              <Shield className="w-5 h-5 text-green-500" />
            </div>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold mb-1">Secure</div>
          <div className="text-sm text-zinc-400">Overall Security Status</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-red-950 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <span className="text-xs px-2 py-1 bg-red-950 text-red-400 rounded">Active</span>
          </div>
          <div className="text-2xl font-bold mb-1">3</div>
          <div className="text-sm text-zinc-400">Active Threats</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-950 rounded-lg">
              <Globe className="w-5 h-5 text-blue-500" />
            </div>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold mb-1">2.4M</div>
          <div className="text-sm text-zinc-400">Threats Blocked (24h)</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-950 rounded-lg">
              <Shield className="w-5 h-5 text-purple-500" />
            </div>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold mb-1">99.97%</div>
          <div className="text-sm text-zinc-400">System Integrity</div>
        </div>
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
