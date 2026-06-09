import { useEffect, useState } from 'react';
import { CheckCircle, Globe, MapPin, MessageSquare, Radio, Send, Shield, Trash2, Users, type LucideIcon } from 'lucide-react';
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
  updates: { id: string; body: string; time: string; createdAt: string }[];
};

const severityStyles: Record<Broadcast['severity'], { banner: string; badge: string; border: string }> = {
  critical: { banner: 'bg-red-950', badge: 'bg-red-900 text-red-400', border: 'border-red-700' },
  high: { banner: 'bg-orange-950', badge: 'bg-orange-900 text-orange-400', border: 'border-orange-700' },
  medium: { banner: 'bg-yellow-950', badge: 'bg-yellow-900 text-yellow-400', border: 'border-yellow-700' },
  low: { banner: 'bg-blue-950', badge: 'bg-blue-900 text-blue-400', border: 'border-blue-700' },
};

const allRegions = ['Central', 'North', 'South', 'East', 'West', 'Nationwide'];
const allAgencies = ['MOH', 'PUB', 'LTA', 'SCDF', 'SPF', 'NEA', 'Enterprise SG'];

export default function GovBroadcast() {
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<Broadcast['severity']>('medium');
  const [sendToCitizens, setSendToCitizens] = useState(true);
  const [sendToAgencies, setSendToAgencies] = useState(false);
  const [sendToRegions, setSendToRegions] = useState(false);
  const [regions, setRegions] = useState<string[]>([]);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [selectedResolvedIds, setSelectedResolvedIds] = useState<string[]>([]);
  const [selectedOngoingId, setSelectedOngoingId] = useState<string | null>(null);
  const [updateBody, setUpdateBody] = useState('');
  const [sendingUpdateId, setSendingUpdateId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
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
  const toggleResolvedSelection = (id: string) => setSelectedResolvedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  const audienceSelected = sendToCitizens || sendToAgencies || sendToRegions;

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

  const handleMarkUnresolved = async (id: string) => {
    try {
      const response = await fetch(apiUrl(`/api/broadcasts/${id}/unresolve`), { method: 'PATCH', headers: authHeaders() });
      if (!response.ok) throw new Error('Unresolve failed');
      const data = await response.json() as { item: Broadcast };
      setBroadcasts((prev) => prev.map((item) => item.id === id ? data.item : item));
      setSelectedResolvedIds((prev) => prev.filter((item) => item !== id));
    } catch {
      setNotice('Could not mark broadcast as ongoing in backend.');
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    try {
      const response = await fetch(apiUrl(`/api/broadcasts/${id}`), { method: 'DELETE', headers: authHeaders() });
      if (!response.ok) throw new Error('Delete failed');
      setBroadcasts((prev) => prev.filter((item) => item.id !== id));
      setSelectedResolvedIds((prev) => prev.filter((item) => item !== id));
    } catch {
      setNotice('Could not delete broadcast in backend.');
    }
  };

  const handleBatchUnresolve = async () => {
    await Promise.all(selectedResolvedIds.map((id) => handleMarkUnresolved(id)));
  };

  const handleBatchDelete = async () => {
    await Promise.all(selectedResolvedIds.map((id) => handleDeleteBroadcast(id)));
    setDeleteConfirmOpen(false);
  };

  const handleAddUpdate = async (id: string) => {
    if (!updateBody.trim()) return;
    setSendingUpdateId(id);
    try {
      const response = await fetch(apiUrl(`/api/broadcasts/${id}/updates`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ body: updateBody }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error ?? 'Update failed');
      }
      const data = await response.json() as { item: Broadcast['updates'][number] };
      setBroadcasts((prev) => prev.map((item) => item.id === id ? { ...item, updates: [...(item.updates ?? []), data.item] } : item));
      setUpdateBody('');
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not add broadcast update in backend.');
    } finally {
      setSendingUpdateId(null);
    }
  };

  const handleBroadcast = async () => {
    if (!title || !message || !audienceSelected) return;
    const targetTypes = [
      sendToCitizens ? 'all_citizens' : null,
      sendToAgencies ? 'agencies' : null,
      sendToRegions ? 'regions' : null,
    ].filter(Boolean);
    try {
      const response = await fetch(apiUrl('/api/broadcasts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          title,
          message,
          severity,
          targetType: sendToCitizens ? 'all_citizens' : sendToAgencies ? 'agencies' : 'regions',
          targetTypes,
          targetAgencies: sendToAgencies ? selectedAgencies : [],
          targetRegions: sendToRegions ? regions : [],
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

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
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
            <AudienceToggle active={sendToCitizens} onClick={() => setSendToCitizens((value) => !value)} label="All Citizens" icon={Globe} />
            <AudienceToggle active={sendToAgencies} onClick={() => setSendToAgencies((value) => !value)} label="Selected Agencies" icon={Users} />
            <AudienceToggle active={sendToRegions} onClick={() => setSendToRegions((value) => !value)} label="Selected Regions" icon={MapPin} />
          </div>

          {sendToAgencies && <Picker items={allAgencies} selected={selectedAgencies} toggle={toggleAgency} color="blue" />}
          {sendToRegions && <Picker items={allRegions} selected={regions} toggle={toggleRegion} color="red" />}

          <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
            <button onClick={handleBroadcast} disabled={!title || !message || !audienceSelected} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors font-medium">
              <Send className="w-4 h-4" />
              Broadcast
            </button>
          </div>
        </div>
      </div>

      <BroadcastList
        title={`Ongoing Alerts (${ongoingBroadcasts.length})`}
        items={ongoingBroadcasts}
        onResolve={handleResolve}
        selectedOngoingId={selectedOngoingId}
        onSelectOngoing={(id) => {
          setSelectedOngoingId((current) => current === id ? null : id);
          setUpdateBody('');
        }}
        updateBody={updateBody}
        onUpdateBodyChange={setUpdateBody}
        onAddUpdate={handleAddUpdate}
        sendingUpdateId={sendingUpdateId}
      />
      <BroadcastList
        title="Alert History - Resolved"
        items={resolvedBroadcasts}
        resolved
        selectedIds={selectedResolvedIds}
        onToggleSelect={toggleResolvedSelection}
        onSelectAll={() => setSelectedResolvedIds(resolvedBroadcasts.map((item) => item.id))}
        onClearSelection={() => setSelectedResolvedIds([])}
        onBatchDelete={() => setDeleteConfirmOpen(true)}
        onBatchUnresolve={handleBatchUnresolve}
      />
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-2 flex items-center gap-2 text-lg font-semibold">
              <Trash2 className="h-5 w-5 text-red-400" />
              Delete resolved broadcasts?
            </div>
            <p className="mb-5 text-sm text-zinc-400">
              This permanently removes {selectedResolvedIds.length} selected resolved alert{selectedResolvedIds.length === 1 ? '' : 's'} from the broadcast history.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBatchDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Notice({ color, text }: { color: 'green' | 'red'; text: string }) {
  return <div className={`flex items-center gap-3 p-3 rounded-lg text-sm ${color === 'green' ? 'bg-green-950/50 border border-green-800 text-green-400' : 'bg-red-950/50 border border-red-800 text-red-300'}`}><CheckCircle className="w-4 h-4" />{text}</div>;
}

function AudienceToggle({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon: LucideIcon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border transition-colors text-xs ${
        active ? 'bg-red-950 border-red-700 text-red-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
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

function BroadcastList({
  title,
  items,
  onResolve,
  resolved = false,
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBatchDelete,
  onBatchUnresolve,
  selectedOngoingId,
  onSelectOngoing,
  updateBody = '',
  onUpdateBodyChange,
  onAddUpdate,
  sendingUpdateId,
}: {
  title: string;
  items: Broadcast[];
  onResolve?: (id: string) => void;
  resolved?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onBatchDelete?: () => void;
  onBatchUnresolve?: () => void;
  selectedOngoingId?: string | null;
  onSelectOngoing?: (id: string) => void;
  updateBody?: string;
  onUpdateBodyChange?: (value: string) => void;
  onAddUpdate?: (id: string) => void;
  sendingUpdateId?: string | null;
}) {
  if (!items.length) return null;
  const allSelected = selectedIds.length === items.length;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className={`text-lg font-semibold ${resolved ? 'text-zinc-400' : ''}`}>{title}</h2>
        {resolved && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={allSelected ? onClearSelection : onSelectAll}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              {allSelected ? 'Clear' : 'Select all'}
            </button>
            <button
              type="button"
              onClick={onBatchUnresolve}
              disabled={!selectedIds.length}
              className="rounded-lg border border-blue-800 bg-blue-950 px-3 py-1.5 text-xs text-blue-300 transition-colors hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Mark unresolved
            </button>
            <button
              type="button"
              onClick={onBatchDelete}
              disabled={!selectedIds.length}
              className="flex items-center gap-1.5 rounded-lg border border-red-800 bg-red-950 px-3 py-1.5 text-xs text-red-300 transition-colors hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </div>
        )}
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className={`p-4 bg-zinc-800 border rounded-lg ${severityStyles[item.severity].border} ${resolved ? 'opacity-70' : ''}`}>
            <div className="flex items-start justify-between mb-2">
              {resolved && onToggleSelect && (
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => onToggleSelect(item.id)}
                  className="mt-1 mr-3 h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-red-600"
                  aria-label={`Select ${item.title}`}
                />
              )}
              <button
                type="button"
                onClick={() => !resolved && onSelectOngoing?.(item.id)}
                className={`flex-1 text-left ${!resolved && onSelectOngoing ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{item.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${severityStyles[item.severity].badge}`}>{item.severity.toUpperCase()}</span>
                </div>
                <div className="text-xs text-zinc-400">{item.time} - {item.recipients.toLocaleString()} recipients - {item.target}</div>
              </button>
              {!resolved && onResolve && (
                <div className="ml-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectOngoing?.(item.id);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                      selectedOngoingId === item.id
                        ? 'border-blue-700 bg-blue-950 text-blue-300'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-700'
                    }`}
                    aria-label={`Reply to ${item.title}`}
                  >
                    <MessageSquare className="w-3 h-3" />
                    Reply
                  </button>
                  <button onClick={() => onResolve(item.id)} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-green-950 border border-green-800 text-green-400 hover:bg-green-900 rounded-lg transition-colors">
                    <CheckCircle className="w-3 h-3" />
                    Mark Resolved
                  </button>
                </div>
              )}
            </div>
            <p className="mb-2 text-sm text-zinc-300">{item.message}</p>
            {Boolean(item.updates?.length) && (
              <div className="mb-3 space-y-2 border-l border-zinc-700 pl-3">
                {item.updates.map((update) => (
                  <div key={update.id}>
                    <div className="text-xs text-zinc-500">{update.time}</div>
                    <div className="text-sm text-zinc-300">{update.body}</div>
                  </div>
                ))}
              </div>
            )}
            {!resolved && selectedOngoingId === item.id && onUpdateBodyChange && onAddUpdate && (
              <div className="mb-3 rounded-lg border border-zinc-700 bg-zinc-900 p-3">
                <div className="mb-2 text-xs font-medium text-zinc-400">Situation update</div>
                <textarea
                  value={updateBody}
                  onChange={(event) => onUpdateBodyChange(event.target.value)}
                  rows={3}
                  placeholder="Add an update that citizens will see..."
                  className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600"
                />
                <button
                  type="button"
                  onClick={() => onAddUpdate(item.id)}
                  disabled={!updateBody.trim() || sendingUpdateId === item.id}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-3 w-3" />
                  {sendingUpdateId === item.id ? 'Sending...' : 'Send update'}
                </button>
              </div>
            )}
            <div className="flex gap-1.5 flex-wrap">
              {item.platforms.map((platform) => <span key={platform} className="text-xs px-2 py-0.5 bg-zinc-700 text-zinc-300 rounded">{platform}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
