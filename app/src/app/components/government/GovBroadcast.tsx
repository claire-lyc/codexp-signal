import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Globe, MapPin, MessageSquare, Plus, Radio, Send, Shield, Trash2, Users, X, type LucideIcon } from 'lucide-react';
import { apiUrl } from '../../lib/api';
import { authHeaders } from '../../lib/auth';
import { singaporeAreaGroups } from '../../lib/singaporeLocations';

type Broadcast = {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  time: string;
  createdAt: string;
  platforms: string[];
  recipients: number;
  target: string;
  status: 'ongoing' | 'resolved';
  updates?: { id: string; body: string; time: string; createdAt: string }[];
};

const severityStyles: Record<Broadcast['severity'], { banner: string; badge: string; border: string }> = {
  critical: { banner: 'bg-red-950', badge: 'bg-red-900 text-red-400', border: 'border-red-700' },
  high: { banner: 'bg-orange-950', badge: 'bg-orange-900 text-orange-400', border: 'border-orange-700' },
  medium: { banner: 'bg-yellow-950', badge: 'bg-yellow-900 text-yellow-400', border: 'border-yellow-700' },
  low: { banner: 'bg-blue-950', badge: 'bg-blue-900 text-blue-400', border: 'border-blue-700' },
};

const allAgencies = ['MOH', 'PUB', 'LTA', 'SCDF', 'SPF', 'NEA', 'Enterprise SG'];
type OngoingSort = 'newest' | 'oldest' | 'severity' | 'audience';

export default function GovBroadcast() {
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<Broadcast['severity']>('medium');
  const [sendToAgencies, setSendToAgencies] = useState(false);
  const [regions, setRegions] = useState<string[]>([]);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [selectedResolvedIds, setSelectedResolvedIds] = useState<string[]>([]);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(null);
  const [updateBody, setUpdateBody] = useState('');
  const [sendingUpdateId, setSendingUpdateId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);
  const [notice, setNotice] = useState('');
  const [ongoingSort, setOngoingSort] = useState<OngoingSort>('newest');
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    loadBroadcasts();
  }, []);

  const loadBroadcasts = async () => {
    try {
      const response = await fetch(apiUrl('/api/broadcasts'), { headers: authHeaders() });
      if (!response.ok) throw new Error('Broadcast API unavailable');
      const data = await response.json() as { items: Broadcast[] };
      setBroadcasts(data.items);
      setSelectedBroadcastId((current) => current && data.items.some((item) => item.id === current) ? current : data.items[0]?.id ?? null);
    } catch {
      setNotice('Broadcast API unavailable. Sign in and retry.');
    }
  };

  const toggleRegion = (region: string) => setRegions((prev) => prev.includes(region) ? prev.filter((item) => item !== region) : [...prev, region]);
  const toggleAgency = (agency: string) => setSelectedAgencies((prev) => prev.includes(agency) ? prev.filter((item) => item !== agency) : [...prev, agency]);
  const toggleResolvedSelection = (id: string) => setSelectedResolvedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  const audienceSelected = true;

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
      setBroadcasts((prev) => {
        const next = prev.filter((item) => item.id !== id);
        setSelectedBroadcastId((current) => current === id ? next[0]?.id ?? null : current);
        return next;
      });
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
    try {
      const response = await fetch(apiUrl('/api/broadcasts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          title,
          message,
          severity,
          targetType: sendToAgencies && !regions.length ? 'agencies' : 'all_citizens',
          targetAgencies: sendToAgencies ? selectedAgencies : [],
          targetRegions: regions,
          platforms: ['Web', 'Mobile', 'SMS'],
        }),
      });
      if (!response.ok) throw new Error('Broadcast failed');
      const data = await response.json() as { item: Broadcast };
      setBroadcasts((prev) => [data.item, ...prev]);
      setSelectedBroadcastId(data.item.id);
      setBroadcastSuccess(true);
      setTitle('');
      setMessage('');
      setRegions([]);
      setSelectedAgencies([]);
      setSendToAgencies(false);
      setComposerOpen(false);
      setTimeout(() => setBroadcastSuccess(false), 3000);
    } catch {
      setNotice('Could not create broadcast in backend.');
    }
  };

  const ongoingBroadcasts = [...broadcasts.filter((item) => item.status === 'ongoing')].sort((left, right) => {
    if (ongoingSort === 'oldest') return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    if (ongoingSort === 'severity') return severityRank(left.severity) - severityRank(right.severity) || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    if (ongoingSort === 'audience') return right.recipients - left.recipients;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
  const resolvedBroadcasts = broadcasts.filter((item) => item.status === 'resolved');
  const selectedBroadcast = useMemo(
    () => broadcasts.find((item) => item.id === selectedBroadcastId) ?? ongoingBroadcasts[0] ?? resolvedBroadcasts[0] ?? null,
    [broadcasts, ongoingBroadcasts, resolvedBroadcasts, selectedBroadcastId],
  );

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Broadcast Centre</h1>
            <p className="text-zinc-400">Compose, monitor, and update official alerts in one place.</p>
          </div>
          <button
            type="button"
            onClick={() => setComposerOpen((open) => !open)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${composerOpen ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700' : 'bg-red-600 text-white hover:bg-red-700'}`}
          >
            {composerOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {composerOpen ? 'Close composer' : 'Compose alert'}
          </button>
        </div>

        <div className="rounded-xl border border-red-900/50 bg-gradient-to-r from-red-950/50 to-orange-950/50 p-5">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-red-400" />
            <div className="flex-1">
              <div className="font-semibold flex items-center gap-2">
                Government-Authenticated Broadcast System
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <p className="mt-0.5 text-sm text-zinc-300">Resolved broadcasts update citizen alerts through the shared database.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-4">
        {broadcastSuccess && <Notice color="green" text="Broadcast sent successfully. It will appear in the citizen Alerts page." />}
        {notice && <Notice color="red" text={notice} />}

        {composerOpen && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 p-4">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-red-400" />
                <h2 className="font-semibold">Compose Emergency Alert</h2>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Enter alert title..." className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-600" />
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Compose your emergency message..." rows={5} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-600" />

              <div className="grid grid-cols-4 gap-2">
                {(['critical', 'high', 'medium', 'low'] as const).map((item) => (
                  <button key={item} onClick={() => setSeverity(item)} className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${severity === item ? `${severityStyles[item].banner} ${severityStyles[item].border} text-white` : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}>
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </button>
                ))}
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-200">
                  <Globe className="h-4 w-4 text-red-400" />
                  Citizen audience
                </div>
                <div className="mb-2 text-xs text-zinc-500">
                  Leave area filters empty to send islandwide. Select specific Singapore areas to narrow the citizen alert zone.
                </div>
                <GroupedAreaPicker groups={singaporeAreaGroups} selected={regions} toggle={toggleRegion} />
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="mb-3 flex items-center gap-3">
                  <AudienceToggle active={sendToAgencies} onClick={() => setSendToAgencies((value) => !value)} label="Also send to selected agencies" icon={Users} />
                </div>
                {sendToAgencies ? <Picker items={allAgencies} selected={selectedAgencies} toggle={toggleAgency} color="blue" /> : <div className="text-xs text-zinc-500">Agency recipients are optional and can be added alongside citizen alerts.</div>}
              </div>

              <div className="flex items-center gap-3 border-t border-zinc-800 pt-4">
                <button onClick={handleBroadcast} disabled={!title || !message || !audienceSelected} className="flex-1 flex items-center justify-center gap-2 rounded bg-red-600 px-4 py-2 font-medium transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                  <Send className="w-4 h-4" />
                  Broadcast
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(360px,0.85fr)_minmax(0,1.15fr)]">
          <section className="min-w-0 space-y-4">
            <BroadcastQueue
              title={`Ongoing Alerts (${ongoingBroadcasts.length})`}
              items={ongoingBroadcasts}
              sort={ongoingSort}
              onSortChange={setOngoingSort}
              selectedId={selectedBroadcast?.status === 'ongoing' ? selectedBroadcast.id : null}
              onSelect={(id) => {
                setSelectedBroadcastId((current) => current === id ? null : id);
                setUpdateBody('');
              }}
            />
            <BroadcastQueue
              title={`Resolved History (${resolvedBroadcasts.length})`}
              items={resolvedBroadcasts}
              resolved
              selectedId={selectedBroadcast?.status === 'resolved' ? selectedBroadcast.id : null}
              onSelect={(id) => setSelectedBroadcastId((current) => current === id ? null : id)}
              selectedIds={selectedResolvedIds}
              onToggleSelect={toggleResolvedSelection}
              onSelectAll={() => setSelectedResolvedIds(resolvedBroadcasts.map((item) => item.id))}
              onClearSelection={() => setSelectedResolvedIds([])}
              onBatchDelete={() => setDeleteConfirmOpen(true)}
              onBatchUnresolve={handleBatchUnresolve}
            />
          </section>

          <aside className="space-y-4">
            <BroadcastDetailPanel
              item={selectedBroadcast}
              updateBody={updateBody}
              onUpdateBodyChange={setUpdateBody}
              onAddUpdate={handleAddUpdate}
              onResolve={handleResolve}
              sendingUpdateId={sendingUpdateId}
            />
          </aside>
        </div>
      </div>

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
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
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

function GroupedAreaPicker({
  groups,
  selected,
  toggle,
}: {
  groups: Array<{ id: string; label: string; areas: string[] }>;
  selected: string[];
  toggle: (item: string) => void;
}) {
  const allAreas = groups.flatMap((group) => group.areas);
  const nationwideSelected = allAreas.length > 0 && allAreas.every((area) => selected.includes(area));

  const setGroupSelection = (areas: string[]) => {
    const allSelected = areas.every((area) => selected.includes(area));
    areas.forEach((area) => {
      const hasArea = selected.includes(area);
      if (allSelected && hasArea) {
        toggle(area);
      }
      if (!allSelected && !hasArea) {
        toggle(area);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-400">
            {nationwideSelected ? 'Entire Singapore selected' : selected.length ? `${selected.length} planning area${selected.length === 1 ? '' : 's'} selected` : 'No area filter applied'}
          </span>
          {selected.length ? (
            <button
              type="button"
              onClick={() => setGroupSelection(allAreas)}
              className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              {nationwideSelected ? 'Clear all' : 'Select all'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setGroupSelection(allAreas)}
              className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              Select islandwide
            </button>
          )}
        </div>
        {!nationwideSelected && selected.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selected.slice(0, 8).map((area) => (
              <span key={area} className="rounded-full bg-red-600/15 px-2.5 py-1 text-[11px] text-red-200">
                {area}
              </span>
            ))}
            {selected.length > 8 ? (
              <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-400">
                +{selected.length - 8} more
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
      {groups.map((group) => {
        const groupAreas = group.areas;
        const groupSelected = groupAreas.length > 0 && groupAreas.every((area) => selected.includes(area));

        return (
        <div key={group.id} className="rounded-xl border border-zinc-800 bg-zinc-900/55 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setGroupSelection(groupAreas)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                groupSelected
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {group.label}
            </button>
            <span className="text-[11px] text-zinc-500">
              {`${group.areas.filter((area) => selected.includes(area)).length}/${group.areas.length} selected`}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {group.areas.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => toggle(area)}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${selected.includes(area) ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>
      )})}
      </div>
    </div>
  );
}

function BroadcastQueue({
  title,
  items,
  resolved = false,
  sort,
  onSortChange,
  selectedId,
  onSelect,
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBatchDelete,
  onBatchUnresolve,
}: {
  title: string;
  items: Broadcast[];
  resolved?: boolean;
  sort?: OngoingSort;
  onSortChange?: (value: OngoingSort) => void;
  selectedId?: string | null;
  onSelect: (id: string) => void;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onBatchDelete?: () => void;
  onBatchUnresolve?: () => void;
}) {
  if (!items.length) return null;
  const allSelected = selectedIds.length === items.length;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className={`text-lg font-semibold ${resolved ? 'text-zinc-400' : ''}`}>{title}</h2>
        {!resolved && sort && onSortChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-zinc-500">Sort</span>
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as OngoingSort)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="severity">Highest severity</option>
              <option value="audience">Largest audience</option>
            </select>
          </div>
        )}
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
          <div key={item.id} className={`rounded-xl border p-4 transition-colors ${selectedId === item.id ? `bg-zinc-950/70 ${severityStyles[item.severity].border}` : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'} ${resolved ? 'opacity-85' : ''}`}>
            <div className="mb-2 flex items-start gap-3">
              {resolved && onToggleSelect ? (
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => onToggleSelect(item.id)}
                  className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-red-600"
                  aria-label={`Select ${item.title}`}
                />
              ) : null}
              <button type="button" onClick={() => onSelect(item.id)} className="min-w-0 flex-1 text-left">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-100">{item.title}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${severityStyles[item.severity].badge}`}>{item.severity.toUpperCase()}</span>
                </div>
                <div className="text-xs text-zinc-400">{item.time}</div>
                <div className="mt-1 text-xs text-zinc-500">{item.recipients.toLocaleString()} recipients • {item.target}</div>
                <p className="mt-3 line-clamp-2 text-sm text-zinc-300">{item.message}</p>
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.platforms.map((platform) => <span key={platform} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">{platform}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BroadcastDetailPanel({
  item,
  updateBody,
  onUpdateBodyChange,
  onAddUpdate,
  onResolve,
  sendingUpdateId,
}: {
  item: Broadcast | null;
  updateBody: string;
  onUpdateBodyChange: (value: string) => void;
  onAddUpdate: (id: string) => void;
  onResolve: (id: string) => void;
  sendingUpdateId: string | null;
}) {
  if (!item) {
    return (
      <aside className="min-h-[560px] rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
          <MessageSquare className="mb-4 h-12 w-12" />
          <h2 className="text-lg font-semibold text-zinc-300">Select a broadcast</h2>
          <p className="mt-2 text-sm">The full alert, updates, and status controls will appear here.</p>
        </div>
      </aside>
    );
  }

  const resolved = item.status === 'resolved';
  const updates = item.updates ?? [];

  return (
    <aside className={`min-h-[560px] overflow-hidden rounded-xl border bg-zinc-900 ${resolved ? 'border-green-800/70' : severityStyles[item.severity].border}`}>
      <div className="border-b border-zinc-800 p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-zinc-100">{item.title}</h2>
          <span className={`rounded-full px-2 py-1 text-xs ${resolved ? 'bg-green-950 text-green-300' : severityStyles[item.severity].badge}`}>{resolved ? 'RESOLVED' : item.severity.toUpperCase()}</span>
        </div>
        <div className="text-sm text-zinc-400">{item.time}</div>
      </div>

      <div className="space-y-5 p-4">
        <div className="flex flex-wrap gap-2">
          <DetailBadge text={item.target} />
          <DetailBadge text={`${item.recipients.toLocaleString()} recipients`} />
          {item.platforms.map((platform) => <DetailBadge key={platform} text={platform} />)}
        </div>

        <p className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-sm leading-6 text-zinc-200">{item.message}</p>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-zinc-200">Updates</div>
          {updates.length ? (
            <div className="space-y-3">
              {updates.map((update) => (
                <div key={update.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                  <div className="mb-1 text-xs text-zinc-500">{update.time}</div>
                  <div className="text-sm text-zinc-300">{update.body}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 p-4 text-sm text-zinc-500">
              No situation updates have been posted yet.
            </div>
          )}
        </div>

        {!resolved ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="mb-2 text-sm font-semibold text-zinc-200">Post situation update</div>
            <textarea
              value={updateBody}
              onChange={(event) => onUpdateBodyChange(event.target.value)}
              rows={4}
              placeholder="Add an update that citizens will see..."
              className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onAddUpdate(item.id)}
                disabled={!updateBody.trim() || sendingUpdateId === item.id}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                {sendingUpdateId === item.id ? 'Sending...' : 'Send update'}
              </button>
              <button
                type="button"
                onClick={() => onResolve(item.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-green-800 bg-green-950 px-3 py-2 text-sm text-green-300 transition-colors hover:bg-green-900"
              >
                <CheckCircle className="h-4 w-4" />
                Mark resolved
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function DetailBadge({ text }: { text: string }) {
  return <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">{text}</span>;
}

function severityRank(severity: Broadcast['severity']) {
  if (severity === 'critical') return 0;
  if (severity === 'high') return 1;
  if (severity === 'medium') return 2;
  return 3;
}
