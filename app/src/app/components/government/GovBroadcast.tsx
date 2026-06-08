import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Eye, Globe, MapPin, Radio, Send, Shield, Users } from 'lucide-react';
import { apiUrl } from '../../lib/api';
import { authHeaders } from '../../lib/auth';

type Broadcast = {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  time: string;
  platforms: string[];
  recipients: number;
  target: string;
  status: 'ongoing' | 'resolved';
};

const severityStyles: Record<Broadcast['severity'], { banner: string; badge: string; border: string }> = {
  critical: { banner: 'bg-red-950', badge: 'bg-red-900 text-red-400', border: 'border-red-700' },
  high: { banner: 'bg-orange-950', badge: 'bg-orange-900 text-orange-400', border: 'border-orange-700' },
  medium: { banner: 'bg-yellow-950', badge: 'bg-yellow-900 text-yellow-400', border: 'border-yellow-700' },
  low: { banner: 'bg-blue-950', badge: 'bg-blue-900 text-blue-400', border: 'border-blue-700' },
};

const allRegions = ['Central', 'North', 'South', 'East', 'West', 'Nationwide'];
const allAgencies = ['MOH', 'PUB', 'LTA', 'SCDF', 'SPF', 'NEA', 'Enterprise SG'];
type BroadcastTarget = 'citizens' | 'agencies' | 'regions';

export default function GovBroadcast() {
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<Broadcast['severity']>('medium');
  const [broadcastTarget, setBroadcastTarget] = useState<BroadcastTarget>('citizens');
  const [regions, setRegions] = useState<string[]>([]);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    loadBroadcasts();
  }, []);

  const loadBroadcasts = async () => {
    try {
      const response = await fetch(apiUrl('/api/broadcasts'), { headers: authHeaders() });
      if (!response.ok) throw new Error('Broadcast API unavailable');
      const data = await response.json() as { items: Broadcast[] };
      setBroadcasts(data.items);
    } catch {
      setNotice('Broadcast API unavailable. Sign in and retry.');
    }
  };

  const toggleRegion = (region: string) => setRegions((prev) => prev.includes(region) ? prev.filter((item) => item !== region) : [...prev, region]);
  const toggleAgency = (agency: string) => setSelectedAgencies((prev) => prev.includes(agency) ? prev.filter((item) => item !== agency) : [...prev, agency]);

  const handleResolve = async (id: string) => {
    try {
      const response = await fetch(apiUrl(`/api/broadcasts/${id}/resolve`), { method: 'PATCH', headers: authHeaders() });
      if (!response.ok) throw new Error('Resolve failed');
      const data = await response.json() as { item: Broadcast };
      setBroadcasts((prev) => prev.map((item) => item.id === id ? data.item : item));
    } catch {
      setNotice('Could not resolve broadcast in backend.');
    }
  };

  const handleBroadcast = async () => {
    if (!title || !message) return;
    try {
      const response = await fetch(apiUrl('/api/broadcasts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          title,
          message,
          severity,
          targetType: broadcastTarget === 'citizens' ? 'all_citizens' : broadcastTarget,
          targetRegions: broadcastTarget === 'regions' ? regions : [],
          platforms: ['Web', 'Mobile', 'SMS'],
        }),
      });
      if (!response.ok) throw new Error('Broadcast failed');
      const data = await response.json() as { item: Broadcast };
      setBroadcasts((prev) => [data.item, ...prev]);
      setBroadcastSuccess(true);
      setTitle('');
      setMessage('');
      setTimeout(() => setBroadcastSuccess(false), 3000);
    } catch {
      setNotice('Could not create broadcast in backend.');
    }
  };

  const ongoingBroadcasts = broadcasts.filter((item) => item.status === 'ongoing');
  const resolvedBroadcasts = broadcasts.filter((item) => item.status === 'resolved');

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
            <p className="text-sm text-zinc-300 mt-0.5">Resolved broadcasts update citizen alerts through the shared database.</p>
          </div>
        </div>
      </div>

      {broadcastSuccess && <Notice color="green" text="Broadcast sent successfully. It will appear in the citizen Alerts page." />}
      {notice && <Notice color="red" text={notice} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-600" />
            Compose Emergency Alert
          </h2>

          <div className="space-y-4">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Enter alert title..." className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600" />
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Compose your emergency message..." rows={5} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600" />

            <div className="grid grid-cols-4 gap-2">
              {(['critical', 'high', 'medium', 'low'] as const).map((item) => (
                <button key={item} onClick={() => setSeverity(item)} className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${severity === item ? `${severityStyles[item].banner} ${severityStyles[item].border} text-white` : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}>
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'citizens', label: 'All Citizens', icon: Globe },
                { key: 'agencies', label: 'Selected Agencies', icon: Users },
                { key: 'regions', label: 'Selected Regions', icon: MapPin },
              ].map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setBroadcastTarget(key as BroadcastTarget)} className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border transition-colors text-xs ${broadcastTarget === key ? 'bg-red-950 border-red-700 text-red-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}>
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {broadcastTarget === 'regions' && <Picker items={allRegions} selected={regions} toggle={toggleRegion} color="red" />}
            {broadcastTarget === 'agencies' && <Picker items={allAgencies} selected={selectedAgencies} toggle={toggleAgency} color="blue" />}

            <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
              <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors text-sm">
                <Eye className="w-4 h-4" />Preview
              </button>
              <button onClick={handleBroadcast} disabled={!title || !message} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors font-medium">
                <Send className="w-4 h-4" />
                Broadcast
              </button>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Live Preview</h2>
          <div className={`p-3 rounded border ${severityStyles[severity].banner} ${severityStyles[severity].border}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium text-sm">{title || 'Alert Title'}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ml-auto ${severityStyles[severity].badge}`}>{severity.toUpperCase()}</span>
            </div>
            <p className="text-xs text-zinc-300">{message || 'Your message will appear here...'}</p>
          </div>
        </div>
      </div>

      <BroadcastList title={`Ongoing Alerts (${ongoingBroadcasts.length})`} items={ongoingBroadcasts} onResolve={handleResolve} />
      <BroadcastList title="Alert History - Resolved" items={resolvedBroadcasts} resolved />
    </div>
  );
}

function Notice({ color, text }: { color: 'green' | 'red'; text: string }) {
  return <div className={`flex items-center gap-3 p-3 rounded-lg text-sm ${color === 'green' ? 'bg-green-950/50 border border-green-800 text-green-400' : 'bg-red-950/50 border border-red-800 text-red-300'}`}><CheckCircle className="w-4 h-4" />{text}</div>;
}

function Picker({ items, selected, toggle, color }: { items: string[]; selected: string[]; toggle: (item: string) => void; color: 'red' | 'blue' }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button key={item} onClick={() => toggle(item)} className={`px-3 py-1.5 rounded transition-colors text-sm ${selected.includes(item) ? (color === 'red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white') : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>{item}</button>
      ))}
    </div>
  );
}

function BroadcastList({ title, items, onResolve, resolved = false }: { title: string; items: Broadcast[]; onResolve?: (id: string) => void; resolved?: boolean }) {
  if (!items.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <h2 className={`text-lg font-semibold mb-4 ${resolved ? 'text-zinc-400' : ''}`}>{title}</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className={`p-4 bg-zinc-800 border rounded-lg ${severityStyles[item.severity].border} ${resolved ? 'opacity-70' : ''}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{item.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${severityStyles[item.severity].badge}`}>{item.severity.toUpperCase()}</span>
                </div>
                <div className="text-xs text-zinc-400">{item.time} - {item.recipients.toLocaleString()} recipients - {item.target}</div>
              </div>
              {!resolved && onResolve && (
                <button onClick={() => onResolve(item.id)} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-green-950 border border-green-800 text-green-400 hover:bg-green-900 rounded-lg transition-colors ml-3">
                  <CheckCircle className="w-3 h-3" />
                  Mark Resolved
                </button>
              )}
            </div>
            <p className="mb-2 text-sm text-zinc-300">{item.message}</p>
            <div className="flex gap-1.5 flex-wrap">
              {item.platforms.map((platform) => <span key={platform} className="text-xs px-2 py-0.5 bg-zinc-700 text-zinc-300 rounded">{platform}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
