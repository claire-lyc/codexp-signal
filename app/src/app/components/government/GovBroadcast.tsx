// POST /api/broadcasts
// PATCH /api/broadcasts/{broadcastId}/resolve
import { Radio, Send, Eye, Shield, CheckCircle, AlertTriangle, Globe, Users, MapPin, X } from 'lucide-react';
import { useState } from 'react';

type Broadcast = {
  id: number;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  time: string;
  platforms: string[];
  recipients: number;
  target: string;
  status: 'ongoing' | 'resolved';
};

const initialBroadcasts: Broadcast[] = [
  { id: 1, title: 'Flash Flood Warning — Orchard & East Coast', severity: 'critical', time: '30 mins ago', platforms: ['Web', 'Mobile', 'SMS'], recipients: 450000, target: 'Central, East', status: 'ongoing' },
  { id: 2, title: 'Dengue Red Zone — Bedok North Ave 1', severity: 'high', time: '2 hours ago', platforms: ['Web', 'Mobile', 'SMS', 'Social Media'], recipients: 320000, target: 'East Region', status: 'ongoing' },
  { id: 3, title: 'Panadol Menstrual Shortage Advisory', severity: 'medium', time: '4 hours ago', platforms: ['Web', 'Mobile', 'Email'], recipients: 1200000, target: 'Nationwide', status: 'ongoing' },
  { id: 4, title: 'Haze Health Advisory — PSI 156', severity: 'medium', time: '6 hours ago', platforms: ['Web', 'Mobile', 'Social Media'], recipients: 1200000, target: 'Nationwide', status: 'ongoing' },
  { id: 5, title: 'MRT East-West Line Disruption Update', severity: 'low', time: 'Yesterday 3:00 PM', platforms: ['Web', 'Mobile'], recipients: 340000, target: 'Central, West', status: 'resolved' },
  { id: 6, title: 'Covid-19 Cluster — Jurong West MRT', severity: 'medium', time: 'Yesterday 9:00 AM', platforms: ['Web', 'Mobile', 'SMS'], recipients: 890000, target: 'West Region', status: 'resolved' },
];

const severityStyles: Record<string, { banner: string; badge: string; border: string }> = {
  critical: { banner: 'bg-red-950', badge: 'bg-red-900 text-red-400', border: 'border-red-700' },
  high: { banner: 'bg-orange-950', badge: 'bg-orange-900 text-orange-400', border: 'border-orange-700' },
  medium: { banner: 'bg-yellow-950', badge: 'bg-yellow-900 text-yellow-400', border: 'border-yellow-700' },
  low: { banner: 'bg-blue-950', badge: 'bg-blue-900 text-blue-400', border: 'border-blue-700' },
};

const composerSeverityColors: Record<string, string> = {
  critical: 'bg-red-950 border-red-800',
  high: 'bg-orange-950 border-orange-800',
  medium: 'bg-yellow-950 border-yellow-800',
  low: 'bg-blue-950 border-blue-800',
};

const allRegions = ['Central', 'North', 'South', 'East', 'West', 'Nationwide'];
const allAgencies = ['MOH', 'PUB', 'LTA', 'SCDF', 'SPF', 'NEA', 'Enterprise SG'];

type BroadcastTarget = 'citizens' | 'agencies' | 'regions';

export default function GovBroadcast() {
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [broadcastTarget, setBroadcastTarget] = useState<BroadcastTarget>('citizens');
  const [regions, setRegions] = useState<string[]>([]);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>(initialBroadcasts);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  const toggleRegion = (r: string) => setRegions((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  const toggleAgency = (a: string) => setSelectedAgencies((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);

  const handleResolve = (id: number) => {
    // PATCH /api/broadcasts/{broadcastId}/resolve
    setBroadcasts((prev) => prev.map((b) => b.id === id ? { ...b, status: 'resolved' as const } : b));
  };

  const handleBroadcast = () => {
    // POST /api/broadcasts
    if (!title || !message) return;
    const newBroadcast: Broadcast = {
      id: Date.now(),
      title,
      severity,
      time: 'Just now',
      platforms: ['Web', 'Mobile', 'SMS'],
      recipients: broadcastTarget === 'citizens' ? 5000000 : broadcastTarget === 'agencies' ? 0 : regions.length * 200000,
      target: broadcastTarget === 'citizens' ? 'All Citizens' : broadcastTarget === 'agencies' ? selectedAgencies.join(', ') : regions.join(', '),
      status: 'ongoing',
    };
    setBroadcasts((prev) => [newBroadcast, ...prev]);
    setBroadcastSuccess(true);
    setTitle('');
    setMessage('');
    setTimeout(() => setBroadcastSuccess(false), 3000);
  };

  const ongoingBroadcasts = broadcasts.filter((b) => b.status === 'ongoing');
  const resolvedBroadcasts = broadcasts.filter((b) => b.status === 'resolved');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Broadcast Centre</h1>
        <p className="text-zinc-400">Emergency alert composition and multi-platform distribution to citizens and agencies</p>
      </div>

      <div className="bg-gradient-to-r from-red-950/50 to-orange-950/50 border border-red-900/50 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-red-400" />
          <div className="flex-1">
            <div className="font-semibold flex items-center gap-2">
              Government-Authenticated Broadcast System
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-sm text-zinc-300 mt-0.5">All broadcasts are cryptographically signed. Recipients see Government Verified badge.</p>
          </div>
        </div>
      </div>

      {broadcastSuccess && (
        <div className="flex items-center gap-3 p-3 bg-green-950/50 border border-green-800 rounded-lg text-sm text-green-400">
          <CheckCircle className="w-4 h-4" />
          Broadcast sent successfully. It will appear in the citizen Alerts page.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compose */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-600" />
            Compose Emergency Alert
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Alert Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                type="text"
                placeholder="Enter alert title..."
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Message Content</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Compose your emergency message..."
                rows={5}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              />
              <div className="text-xs text-zinc-500 mt-1">{message.length} / 500 characters</div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Severity Level</label>
              <div className="grid grid-cols-4 gap-2">
                {(['critical', 'high', 'medium', 'low'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeverity(s)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${severity === s ? severityStyles[s].banner + ' ' + severityStyles[s].border + ' text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Broadcast Target</label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {([
                  { key: 'citizens', label: 'All Citizens', icon: Globe },
                  { key: 'agencies', label: 'Selected Agencies', icon: Users },
                  { key: 'regions', label: 'Selected Regions', icon: MapPin },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setBroadcastTarget(key)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border transition-colors text-xs ${broadcastTarget === key ? 'bg-red-950 border-red-700 text-red-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              {broadcastTarget === 'regions' && (
                <div className="flex flex-wrap gap-2">
                  {allRegions.map((r) => (
                    <button key={r} onClick={() => toggleRegion(r)} className={`px-3 py-1.5 rounded transition-colors text-sm ${regions.includes(r) ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>{r}</button>
                  ))}
                </div>
              )}
              {broadcastTarget === 'agencies' && (
                <div className="flex flex-wrap gap-2">
                  {allAgencies.map((a) => (
                    <button key={a} onClick={() => toggleAgency(a)} className={`px-3 py-1.5 rounded transition-colors text-sm ${selectedAgencies.includes(a) ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>{a}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
              <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors text-sm">
                <Eye className="w-4 h-4" />Preview
              </button>
              <button
                onClick={handleBroadcast}
                disabled={!title || !message}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors font-medium"
              >
                <Send className="w-4 h-4" />
                {broadcastTarget === 'citizens' ? 'Broadcast to All Citizens' :
                 broadcastTarget === 'agencies' ? `Broadcast to Agencies (${selectedAgencies.length || '0'} selected)` :
                 `Broadcast to Regions (${regions.length || '0'} selected)`}
              </button>
            </div>

            <div className="bg-yellow-950/30 border border-yellow-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-yellow-400">
                <Shield className="w-4 h-4" />
                Broadcast requires GOV authentication — will be cryptographically signed and feed into citizen Alerts page
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Live Preview</h2>
          <div className="space-y-4">
            <div className="border border-zinc-700 rounded-lg p-4 bg-zinc-800">
              <div className="text-xs text-zinc-500 mb-2">Citizen Alerts Page</div>
              <div className={`p-3 rounded border ${composerSeverityColors[severity]}`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium text-sm">{title || 'Alert Title'}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ml-auto ${severityStyles[severity].badge}`}>{severity.toUpperCase()}</span>
                </div>
                <p className="text-xs text-zinc-300">{message || 'Your message will appear here...'}</p>
              </div>
            </div>

            <div className="border border-zinc-700 rounded-lg p-4 bg-zinc-800">
              <div className="text-xs text-zinc-500 mb-2">Mobile Push</div>
              <div className={`p-3 rounded ${severityStyles[severity].banner}`}>
                <div className="text-xs font-medium mb-1">SiGnal Alert — {severity.toUpperCase()}</div>
                <p className="text-xs">{message || 'Message preview...'}</p>
              </div>
            </div>

            <div className="border border-zinc-700 rounded-lg p-4 bg-zinc-800">
              <div className="text-xs text-zinc-500 mb-2">Distribution</div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-zinc-400" />
                <span className="text-xs text-zinc-400">
                  {broadcastTarget === 'citizens' ? 'All citizens (~5M)' :
                   broadcastTarget === 'agencies' ? `${selectedAgencies.length} agencies selected` :
                   `${regions.length} regions selected`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ongoing alerts */}
      {ongoingBroadcasts.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            Ongoing Alerts ({ongoingBroadcasts.length})
          </h2>
          <div className="space-y-3">
            {ongoingBroadcasts.map((b) => (
              <div key={b.id} className={`p-4 bg-zinc-800 border rounded-lg ${severityStyles[b.severity].border}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{b.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${severityStyles[b.severity].badge}`}>{b.severity.toUpperCase()}</span>
                    </div>
                    <div className="text-xs text-zinc-400">{b.time} · {b.recipients.toLocaleString()} recipients · {b.target}</div>
                  </div>
                  <button
                    onClick={() => handleResolve(b.id)}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-green-950 border border-green-800 text-green-400 hover:bg-green-900 rounded-lg transition-colors ml-3"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Mark Resolved
                  </button>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {b.platforms.map((p) => (
                    <span key={p} className="text-xs px-2 py-0.5 bg-zinc-700 text-zinc-300 rounded">{p}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alert history */}
      {resolvedBroadcasts.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 text-zinc-400">Alert History — Resolved</h2>
          <div className="space-y-2">
            {resolvedBroadcasts.map((b) => (
              <div key={b.id} className="p-3 bg-zinc-800 border border-zinc-700 rounded-lg opacity-70">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{b.title}</span>
                    <div className="text-xs text-zinc-500 mt-0.5">{b.time} · {b.recipients.toLocaleString()} recipients · {b.target}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${severityStyles[b.severity].badge}`}>{b.severity.toUpperCase()}</span>
                    <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-400 rounded">RESOLVED</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
