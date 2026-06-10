// GET /api/citizen/alerts — linked to Government Broadcast Centre
import { Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApi } from '../../lib/api';
import { apiUrl } from '../../lib/api';

type Incident = {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  region: string;
  status: 'active' | 'monitoring' | 'resolved';
  verified: boolean;
  updates: { time: string; text: string }[];
};

type BroadcastAlert = {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  target: string;
  status: 'ongoing' | 'resolved';
  time: string;
  updates: { id: string; body: string; time: string; createdAt: string }[];
};

const pastIncidents: { date: string; items: { title: string; type: string; note: string }[] }[] = [
  {
    date: 'Jun 4, 2026',
    items: [
      { title: 'MRT East-West Line Disruption', type: 'Infrastructure', note: 'Resolved — Service resumed at 6:45 PM.' },
      { title: 'Covid-19 Cluster — Jurong West MRT', type: 'Health', note: 'Resolved — Cluster isolated. Enhanced cleaning completed.' },
    ],
  },
  {
    date: 'Jun 3, 2026',
    items: [
      { title: 'Haze Advisory lifted', type: 'Weather', note: 'Resolved — PSI returned to Good range.' },
    ],
  },
];

const severityConfig: Record<string, { banner: string; dot: string; badge: string; label: string }> = {
  critical: { banner: 'bg-red-950/60 border-red-700', dot: 'bg-red-500', badge: 'bg-red-900 text-red-400', label: 'CRITICAL' },
  high: { banner: 'bg-orange-950/50 border-orange-700', dot: 'bg-orange-500', badge: 'bg-orange-900 text-orange-400', label: 'HIGH' },
  medium: { banner: 'bg-yellow-950/40 border-yellow-700', dot: 'bg-yellow-500', badge: 'bg-yellow-900 text-yellow-400', label: 'MEDIUM' },
  low: { banner: 'bg-blue-950/40 border-blue-700', dot: 'bg-blue-500', badge: 'bg-blue-900 text-blue-400', label: 'LOW' },
};

export default function PublicAlerts() {
  const { data, loading, error } = useApi<{ incidents: Incident[]; pastIncidents: typeof pastIncidents }>('/api/citizen/incidents');
  const [broadcasts, setBroadcasts] = useState<BroadcastAlert[]>([]);
  const pastIncidents = data?.pastIncidents ?? [];
  const [subscribed, setSubscribed] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');

  const activeBroadcasts = broadcasts.filter((item) => item.status === 'ongoing');
  const resolvedBroadcasts = broadcasts.filter((item) => item.status === 'resolved');
  const resolvedBroadcastGroups = groupResolvedBroadcastsByDate(resolvedBroadcasts);

  useEffect(() => {
    fetch(apiUrl('/api/citizen/broadcasts'))
      .then((response) => {
        if (!response.ok) throw new Error('Broadcasts unavailable');
        return response.json() as Promise<{ items: BroadcastAlert[] }>;
      })
      .then((data) => setBroadcasts(data.items))
      .catch(() => setBroadcasts([]));
  }, []);

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Public Alerts</h1>
          <p className="mt-1 text-sm text-zinc-400">Official government broadcasts and resolved advisories</p>
        </div>
        <button
          onClick={() => setSubscribed((s) => !s)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${subscribed ? 'bg-green-700 text-white' : 'bg-zinc-100 text-zinc-950 hover:bg-white'}`}
        >
          {subscribed ? 'Subscribed' : 'Subscribe to Alerts'}
        </button>
      </div>

      {loading && <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">Loading public incidents...</div>}
      {error && <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">Public incidents API unavailable: {error}</div>}

      {(activeBroadcasts.length > 0 || activeTab === 'archive') && (
        <div id="broadcasts">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Government Broadcasts</h2>
            <span className="text-sm text-zinc-400">
              {activeTab === 'active' ? `${activeBroadcasts.length} ongoing` : 'Archive'}
            </span>
          </div>
          <div className="mb-4 mt-1 text-left text-xs text-zinc-500">
            <span>Emergency broadcast over past 90 days.</span>{' '}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'archive' ? 'active' : 'archive')}
              className="text-xs font-semibold text-zinc-200 transition-colors hover:text-white hover:underline"
            >
              {activeTab === 'archive' ? 'View active broadcasts.' : 'View historical broadcasts.'}
            </button>
          </div>

          {activeTab === 'active' ? (
          <div className="space-y-3">
            {activeBroadcasts.map((broadcast) => {
              const cfg = severityConfig[broadcast.severity];
              return (
                <div key={broadcast.id} className={`overflow-hidden rounded-xl border ${cfg.banner}`}>
                  <div className={severityHeaderClass(broadcast.severity)}>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span className="truncate text-base font-bold">{broadcast.title}</span>
                      <span className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">{broadcast.severity}</span>
                    </div>
                    <span className="shrink-0 text-xs opacity-80">{broadcast.time}</span>
                  </div>
                  <div className="space-y-5 bg-zinc-950/85 px-5 py-4">
                    <div>
                      <p className="text-sm font-semibold leading-6 text-zinc-100">{broadcast.message}</p>
                      <div className="mt-1 text-xs text-zinc-500">{broadcast.target} - Government Verified</div>
                    </div>
                    {Boolean(broadcast.updates?.length) && (
                      <div className="space-y-4">
                        {broadcast.updates.map((update) => (
                          <div key={update.id}>
                            <p className="text-sm leading-6 text-zinc-200">
                              <span className="font-bold text-zinc-100">Update</span>
                              <span className="text-zinc-500"> - </span>
                              {update.body}
                            </p>
                            <div className="mt-1 text-xs text-zinc-500">{update.time}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-4 text-sm font-semibold text-zinc-200">Historical Broadcasts</div>
            <div className="space-y-6">
              {resolvedBroadcastGroups.map((group) => (
                <div key={group.date}>
                  <div className="text-sm font-medium text-zinc-500 mb-3 border-b border-zinc-800 pb-2">{group.date}</div>
                  <div className="space-y-2">
                    {group.items.map((broadcast) => (
                      <div key={broadcast.id} className="px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{broadcast.title}</span>
                          <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-400 rounded">Resolved</span>
                        </div>
                        <div className="text-xs text-zinc-500">{broadcast.target} - {broadcast.message}</div>
                        {Boolean(broadcast.updates?.length) && (
                          <div className="mt-2 space-y-1 border-l border-zinc-700 pl-3">
                            {broadcast.updates.map((update) => (
                              <div key={update.id} className="text-xs text-zinc-500">
                                {update.time} - {update.body}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {pastIncidents.map((group) => (
                <div key={group.date}>
                  <div className="text-sm font-medium text-zinc-500 mb-3 border-b border-zinc-800 pb-2">{group.date}</div>
                  <div className="space-y-2">
                    {group.items.map((item, i) => (
                      <div key={i} className="px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{item.title}</span>
                          <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-400 rounded">Resolved</span>
                        </div>
                        <div className="text-xs text-zinc-500">{item.type} - {item.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      )}

      {/* Verification note */}
      <div className="bg-blue-950/30 border border-blue-800 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
          <div className="text-sm text-zinc-300">
            <strong className="text-blue-400">About Alert Verification:</strong> All alerts are cryptographically signed and published by authorised government agencies via the SiGnal Broadcast Centre. Check for the "Government Verified" badge. For immediate life-threatening emergencies, call <strong className="text-red-400">995</strong>.
          </div>
        </div>
      </div>

    </div>
  );
}

function groupResolvedBroadcastsByDate(items: BroadcastAlert[]) {
  const groups = new Map<string, BroadcastAlert[]>();

  items.forEach((item) => {
    const dateLabel = archiveDateLabel(item.time);
    groups.set(dateLabel, [...(groups.get(dateLabel) ?? []), item]);
  });

  return Array.from(groups.entries()).map(([date, groupItems]) => ({ date, items: groupItems }));
}

function archiveDateLabel(value: string) {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return value.split(',')[0] || 'Resolved broadcasts';
}

function severityHeaderClass(severity: BroadcastAlert['severity']) {
  if (severity === 'critical') return 'flex items-center justify-between gap-3 bg-red-600 px-5 py-3 text-white';
  if (severity === 'high') return 'flex items-center justify-between gap-3 bg-orange-600 px-5 py-3 text-white';
  if (severity === 'medium') return 'flex items-center justify-between gap-3 bg-yellow-500 px-5 py-3 text-zinc-950';
  return 'flex items-center justify-between gap-3 bg-blue-600 px-5 py-3 text-white';
}
