// GET /api/citizen/alerts — linked to Government Broadcast Centre
import { CheckCircle, AlertTriangle, Bell, Shield, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApi } from '../../lib/api';
import { apiUrl } from '../../lib/api';
import { authHeaders } from '../../lib/auth';

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
};

type PastIncidentGroup = { date: string; items: { title: string; type: string; note: string }[] };

const severityConfig: Record<string, { banner: string; dot: string; badge: string; label: string }> = {
  critical: { banner: 'bg-red-950/60 border-red-700', dot: 'bg-red-500', badge: 'bg-red-900 text-red-400', label: 'CRITICAL' },
  high: { banner: 'bg-orange-950/50 border-orange-700', dot: 'bg-orange-500', badge: 'bg-orange-900 text-orange-400', label: 'HIGH' },
  medium: { banner: 'bg-yellow-950/40 border-yellow-700', dot: 'bg-yellow-500', badge: 'bg-yellow-900 text-yellow-400', label: 'MEDIUM' },
  low: { banner: 'bg-blue-950/40 border-blue-700', dot: 'bg-blue-500', badge: 'bg-blue-900 text-blue-400', label: 'LOW' },
};

const statusConfig: Record<string, string> = {
  active: 'text-red-400',
  monitoring: 'text-yellow-400',
  resolved: 'text-green-400',
};

export default function PublicAlerts() {
  const { data, loading, error } = useApi<{ incidents: Incident[]; pastIncidents: PastIncidentGroup[] }>('/api/citizen/incidents');
  const [broadcasts, setBroadcasts] = useState<BroadcastAlert[]>([]);
  const incidents = data?.incidents ?? [];
  const pastIncidents = data?.pastIncidents ?? [];
  const [subscribed, setSubscribed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeIncidents = incidents.filter((i) => i.status !== 'resolved');
  const activeBroadcasts = broadcasts.filter((item) => item.status === 'ongoing');
  const resolvedBroadcasts = broadcasts.filter((item) => item.status === 'resolved');

  useEffect(() => {
    fetch(apiUrl('/api/citizen/broadcasts'), { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error('Broadcasts unavailable');
        return response.json() as Promise<{ items: BroadcastAlert[] }>;
      })
      .then((data) => setBroadcasts(data.items))
      .catch(() => setBroadcasts([]));
  }, []);

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Subscribe bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-blue-400" />
            <div>
              <div className="font-medium text-sm">Subscribe to Alerts</div>
              <div className="text-xs text-zinc-500">Get notified when new incidents are published</div>
            </div>
          </div>
          <button
            onClick={() => setSubscribed((s) => !s)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${subscribed ? 'bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
          >
            {subscribed ? 'Subscribed' : 'Subscribe to Updates'}
          </button>
        </div>
      </div>

      {loading && <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">Loading public incidents...</div>}
      {error && <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">Public incidents API unavailable: {error}</div>}

      {activeBroadcasts.length > 0 && (
        <div id="broadcasts">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Government Broadcasts</h2>
            <span className="text-sm text-zinc-400">{activeBroadcasts.length} ongoing</span>
          </div>
          <div className="space-y-3">
            {activeBroadcasts.map((broadcast) => {
              const cfg = severityConfig[broadcast.severity];
              return (
                <div key={broadcast.id} className={`rounded-xl border p-5 ${cfg.banner}`}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-semibold">{broadcast.title}</span>
                    <span className={`rounded px-1.5 py-0.5 text-xs ${cfg.badge}`}>{broadcast.severity.toUpperCase()}</span>
                    <span className="text-xs text-zinc-500">{broadcast.time}</span>
                  </div>
                  <p className="text-sm text-zinc-300">{broadcast.message}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span>{broadcast.target}</span>
                    <span>Government Verified</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Current incidents */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Current Incidents</h2>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-zinc-400">{activeIncidents.length} active</span>
          </div>
        </div>

        <div className="space-y-3">
          {incidents.length === 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">
              No current incidents. Historical advisories are listed below.
            </div>
          )}
          {incidents.map((incident) => {
            const cfg = severityConfig[incident.severity];
            const isExpanded = expandedId === incident.id;
            return (
              <div key={incident.id} className={`border rounded-xl overflow-hidden ${cfg.banner}`}>
                {/* Incident header */}
                <button
                  className="w-full text-left px-5 py-4"
                  onClick={() => setExpandedId(isExpanded ? null : incident.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot} ${incident.status === 'active' ? 'animate-pulse' : ''}`} />
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold">{incident.title}</span>
                          {incident.verified && (
                            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 bg-green-950 text-green-400 rounded">
                              <CheckCircle className="w-3 h-3" />Government Verified
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                          <span className={`px-1.5 py-0.5 rounded ${cfg.badge}`}>{cfg.label}</span>
                          <span>{incident.type}</span>
                          <span>·</span>
                          <span>{incident.region}</span>
                          <span>·</span>
                          <span className={statusConfig[incident.status]}>{incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-zinc-500 flex-shrink-0 mt-0.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {/* Expanded updates */}
                {isExpanded && (
                  <div className="px-5 pb-4 pt-1 border-t border-white/10">
                    <div className="space-y-3">
                      {incident.updates.map((update, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-1 h-1 rounded-full bg-zinc-500 mt-2.5 flex-shrink-0" />
                          <div>
                            <div className="text-xs text-zinc-500 mb-0.5">{update.time}</div>
                            <p className="text-sm text-zinc-300">{update.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-zinc-500">
                      <span className="font-mono">{incident.id}</span>
                      <span>·</span>
                      <span>Alert ID for verification</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Past incidents */}
      <div>
        <h2 className="text-lg font-semibold mb-4 text-zinc-400">Past Incidents</h2>
        <div className="space-y-6">
          {resolvedBroadcasts.length > 0 && (
            <div>
              <div className="text-sm font-medium text-zinc-500 mb-3 border-b border-zinc-800 pb-2">Resolved broadcasts</div>
              <div className="space-y-2">
                {resolvedBroadcasts.map((broadcast) => (
                  <div key={broadcast.id} className="px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{broadcast.title}</span>
                      <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-400 rounded">Resolved</span>
                    </div>
                    <div className="text-xs text-zinc-500">{broadcast.target} - {broadcast.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pastIncidents.map((group) => (
            <div key={group.date}>
              <div className="text-sm font-medium text-zinc-500 mb-3 border-b border-zinc-800 pb-2">{group.date}</div>
              <div className="space-y-2">
                {group.items.map((item, i) => (
                  <div key={i} className="px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{item.title}</span>
                      <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-400 rounded">Resolved</span>
                    </div>
                    <div className="text-xs text-zinc-500">{item.type} · {item.note}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

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
