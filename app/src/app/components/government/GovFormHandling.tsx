import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useSearchParams } from 'react-router';
import {
  Bell,
  CheckCircle,
  Clock,
  Image,
  Layers,
  MapPin,
  MessageSquare,
  Radio,
  Search,
  Send,
  Shield,
  ArrowDownUp,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { API_REFRESH_INTERVAL_MS, apiUrl } from '../../lib/api';
import { authHeaders } from '../../lib/auth';

type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'grouped';
type TicketUrgency = 'critical' | 'high' | 'medium' | 'low';
type TicketComment = {
  id: string;
  author: string;
  visibility: 'public' | 'internal';
  body: string;
  createdAt: string;
};
type TicketImage = {
  id: string;
  filename: string | null;
  mimeType: string | null;
  byteSize: number | null;
  storageKey: string | null;
  previewUrl: string | null;
  status: string;
  createdAt: string;
};
type Ticket = {
  id: string;
  timestamp: string;
  reporter: string;
  message: string;
  location: string;
  crisisType: string;
  status: TicketStatus;
  assignedAgency: string;
  urgency: TicketUrgency;
  hasImage: boolean;
  relatedTickets: string[];
  comments: TicketComment[];
  pingedAgencies: string[];
  images?: TicketImage[];
  chatEnabled?: boolean;
};

type AuthUser = {
  agencyCode: string | null;
};
type SortMode = 'priority' | 'newest' | 'oldest' | 'ticket-number';

const agencies = ['All Agencies', 'MOH', 'PUB', 'LTA', 'Enterprise SG', 'SPF', 'SCDF', 'NEA', 'CSA', 'GOV-OPS'];
const pingableAgencies = ['MOH', 'PUB', 'LTA', 'Enterprise SG', 'SPF', 'SCDF', 'NEA', 'MSF'];
const statusOptions: Array<'All' | TicketStatus> = ['All', 'open', 'in-progress', 'grouped', 'resolved'];
const crisisTypes = ['All', 'Health', 'Weather', 'Supply Chain', 'Infrastructure', 'Cybersecurity'];
const sortOptions: Array<{ value: SortMode; label: string }> = [
  { value: 'priority', label: 'Priority' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'ticket-number', label: 'Ticket number' },
];
const sortIconLabels: Record<SortMode, string> = {
  priority: 'Priority',
  newest: 'Newest',
  oldest: 'Oldest',
  'ticket-number': 'Ticket #',
};
const urgencyRank: Record<TicketUrgency, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const seedTickets: Ticket[] = [
  {
    id: 'TKT-0041',
    timestamp: '2026-06-05 14:22',
    reporter: 'Citizen (Anonymous)',
    message:
      'Panadol Menstrual completely out of stock at Jurong Point Watsons, Unity, and Guardian. Checked 4 outlets in the area.',
    location: 'Jurong Point, West',
    crisisType: 'Supply Chain',
    status: 'open',
    assignedAgency: 'Enterprise SG',
    urgency: 'high',
    hasImage: false,
    relatedTickets: ['TKT-0038', 'TKT-0039'],
    comments: [commentSeed('internal', 'Enterprise SG should verify retail stock and supplier ETA.', 7)],
    pingedAgencies: [],
  },
  {
    id: 'TKT-0040',
    timestamp: '2026-06-05 13:55',
    reporter: 'User #7821',
    message: 'Flooding at Orchard underpass - water knee-deep. Cars stalling.',
    location: 'Orchard Road, Central',
    crisisType: 'Weather',
    status: 'in-progress',
    assignedAgency: 'PUB',
    urgency: 'critical',
    hasImage: true,
    relatedTickets: ['TKT-0036'],
    comments: [commentSeed('internal', 'PUB ops notified. Check whether LTA traffic diversion is needed.', 11)],
    pingedAgencies: ['PUB'],
  },
  {
    id: 'TKT-0039',
    timestamp: '2026-06-05 13:40',
    reporter: 'User #3312',
    message: 'Cannot find Panadol Menstrual anywhere in Tampines Hub area.',
    location: 'Tampines Hub, East',
    crisisType: 'Supply Chain',
    status: 'grouped',
    assignedAgency: 'Enterprise SG',
    urgency: 'medium',
    hasImage: false,
    relatedTickets: ['TKT-0041'],
    comments: [],
    pingedAgencies: [],
  },
  {
    id: 'TKT-0038',
    timestamp: '2026-06-05 13:10',
    reporter: 'User #5509',
    message: 'Dengue symptoms visible in family of 3. Requesting health advisory for Bedok North Ave 1.',
    location: 'Bedok North Ave 1, East',
    crisisType: 'Health',
    status: 'open',
    assignedAgency: 'MOH',
    urgency: 'high',
    hasImage: false,
    relatedTickets: [],
    comments: [],
    pingedAgencies: [],
  },
  {
    id: 'TKT-0037',
    timestamp: '2026-06-05 11:30',
    reporter: 'Citizen (Anonymous)',
    message: 'MRT East-West Line severely delayed at Jurong East station. Platform overcrowded.',
    location: 'Jurong East MRT, West',
    crisisType: 'Infrastructure',
    status: 'resolved',
    assignedAgency: 'LTA',
    urgency: 'medium',
    hasImage: true,
    relatedTickets: [],
    comments: [commentSeed('public', 'Thank you. LTA confirmed service resumed and crowding has cleared.', 140)],
    pingedAgencies: ['LTA'],
  },
  {
    id: 'TKT-0036',
    timestamp: '2026-06-05 10:15',
    reporter: 'User #2201',
    message: 'Road flooded at Orchard Road near Ngee Ann City. Traffic at standstill.',
    location: 'Orchard Road, Central',
    crisisType: 'Weather',
    status: 'grouped',
    assignedAgency: 'PUB',
    urgency: 'critical',
    hasImage: true,
    relatedTickets: ['TKT-0040'],
    comments: [],
    pingedAgencies: ['PUB'],
  },
];

const urgencyColors: Record<TicketUrgency, string> = {
  critical: 'bg-red-900 text-red-400 border-red-800',
  high: 'bg-orange-900 text-orange-400 border-orange-800',
  medium: 'bg-yellow-900 text-yellow-400 border-yellow-800',
  low: 'bg-blue-900 text-blue-400 border-blue-800',
};

const statusColors: Record<TicketStatus, string> = {
  open: 'bg-red-900/40 text-red-400',
  'in-progress': 'bg-blue-900/40 text-blue-400',
  grouped: 'bg-purple-900/40 text-purple-400',
  resolved: 'bg-green-900/40 text-green-400',
};

export default function GovFormHandling() {
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>(seedTickets);
  const [selectedTicketId, setSelectedTicketId] = useState(seedTickets[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | TicketStatus>('All');
  const [filterCrisis, setFilterCrisis] = useState('All');
  const [filterAgency, setFilterAgency] = useState('All Agencies');
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [comment, setComment] = useState('');
  const [commentType, setCommentType] = useState<'public' | 'internal'>('public');
  const [pingOpen, setPingOpen] = useState(false);
  const [pinnedAgencies, setPinnedAgencies] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [usingBackend, setUsingBackend] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingTicket, setDeletingTicket] = useState(false);

  useEffect(() => {
    let active = true;
    const requestedTicket = searchParams.get('ticket');
    let requestedTicketDetailsLoaded = false;

    fetch(apiUrl('/api/auth/me'), { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error('Profile API unavailable');
        return response.json() as Promise<{ user: AuthUser | null }>;
      })
      .then((data) => {
        if (!active) return;
        const agencyCode = data.user?.agencyCode;
        setFilterAgency(agencyCode && agencies.includes(agencyCode) ? agencyCode : 'All Agencies');
      })
      .catch(() => {
        if (!active) return;
        setFilterAgency('All Agencies');
      });

    const loadTickets = () => {
      fetch(apiUrl('/api/tickets'), { headers: authHeaders() })
        .then((response) => {
          if (!response.ok) throw new Error('Ticket API unavailable');
          return response.json() as Promise<{ items: Ticket[] }>;
        })
        .then((data) => {
          if (!active) return;
          setUsingBackend(true);
          setTickets(data.items);
          setSelectedTicketId((current) => {
            const next = requestedTicket || current || data.items[0]?.id || '';
            if (requestedTicket && !requestedTicketDetailsLoaded) {
              requestedTicketDetailsLoaded = true;
              void fetchTicketDetails(requestedTicket);
            }
            return next;
          });
        })
        .catch(() => {
          if (!active) return;
          const localTickets = loadLocalTickets();
          setUsingBackend(false);
          setTickets(localTickets);
          setSelectedTicketId((current) => current || localTickets[0]?.id || '');
        });
    };

    loadTickets();
    const timer = window.setInterval(loadTickets, API_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [searchParams]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tickets
      .filter((ticket) => {
        const statusMatch = filterStatus === 'All' || ticket.status === filterStatus;
        const crisisMatch = filterCrisis === 'All' || ticket.crisisType === filterCrisis;
        const agencyMatch = filterAgency === 'All Agencies' || ticket.assignedAgency === filterAgency;
        const queryMatch =
          !normalizedQuery ||
          ticket.id.toLowerCase().includes(normalizedQuery) ||
          ticket.message.toLowerCase().includes(normalizedQuery) ||
          ticket.location.toLowerCase().includes(normalizedQuery) ||
          ticket.reporter.toLowerCase().includes(normalizedQuery);
        return statusMatch && crisisMatch && agencyMatch && queryMatch;
      })
      .sort((a, b) => sortTickets(a, b, sortMode));
  }, [filterAgency, filterCrisis, filterStatus, query, sortMode, tickets]);

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) ?? filtered[0] ?? tickets[0];
  const selectedTicketResolved = selectedTicket ? isResolved(selectedTicket) : false;

  const syncTicket = (updated: Ticket) => {
    setTickets((current) => current.map((ticket) => (ticket.id === updated.id ? updated : ticket)));
  };

  const fetchTicketDetails = async (ticketId: string) => {
    try {
      const response = await fetch(apiUrl(`/api/tickets/${ticketId}`), { headers: authHeaders() });
      if (!response.ok) throw new Error('Ticket detail unavailable');
      const data = await response.json() as { item: Ticket };
      syncTicket(data.item);
      setUsingBackend(true);
    } catch {
      // Keep the lightweight list item selected if detail fetch fails.
    }
  };

  const selectTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    void fetchTicketDetails(ticketId);
  };

  const updateStatus = async (ticket: Ticket, status: TicketStatus) => {
    try {
      const data = await requestJson<{ item: Ticket }>(`/api/tickets/${ticket.id}/status`, 'PATCH', { status });
      syncTicket(data.item);
      setUsingBackend(true);
    } catch {
      setUsingBackend(false);
      updateLocalTickets(
        (current) =>
          current.map((item) =>
            item.id === ticket.id
              ? { ...item, status, comments: [...item.comments, createComment('internal', `Status changed to ${status}.`)] }
              : item,
          ),
        setTickets,
      );
    }
    setNotice(`${ticket.id} marked ${status}.`);
  };

  const addComment = async () => {
    if (!selectedTicket || !comment.trim() || isResolved(selectedTicket)) return;

    try {
      const data = await requestJson<{ item: Ticket }>(`/api/tickets/${selectedTicket.id}/comments`, 'POST', {
        body: comment,
        visibility: commentType,
      });
      syncTicket(data.item);
      setUsingBackend(true);
    } catch {
      setUsingBackend(false);
      if (isResolved(selectedTicket)) {
        setNotice(`${selectedTicket.id} is resolved. Discussion is closed.`);
        return;
      }
      updateLocalTickets(
        (current) =>
          current.map((ticket) =>
            ticket.id === selectedTicket.id
              ? { ...ticket, comments: [...ticket.comments, createComment(commentType, comment)] }
              : ticket,
          ),
        setTickets,
      );
    }
    setComment('');
  };

  const pingAgencies = async () => {
    if (!selectedTicket || pinnedAgencies.length === 0) return;

    try {
      const data = await requestJson<{ item: Ticket }>(
        `/api/tickets/${selectedTicket.id}/ping-agencies`,
        'POST',
        { agencyCodes: pinnedAgencies },
      );
      syncTicket(data.item);
      setUsingBackend(true);
    } catch {
      setUsingBackend(false);
      updateLocalTickets(
        (current) =>
          current.map((ticket) =>
            ticket.id === selectedTicket.id
              ? {
                  ...ticket,
                  pingedAgencies: [...new Set([...ticket.pingedAgencies, ...pinnedAgencies])],
                  comments: [...ticket.comments, createComment('internal', `Pinged agencies: ${pinnedAgencies.join(', ')}.`)],
                }
              : ticket,
          ),
        setTickets,
      );
    }

    setNotice(`Agencies pinged: ${pinnedAgencies.join(', ')}.`);
    setPinnedAgencies([]);
    setPingOpen(false);
  };

  const deleteSelectedTicket = async () => {
    if (!selectedTicket || deletingTicket) return;

    setDeletingTicket(true);
    let deleted = false;
    try {
      await requestDelete(`/api/tickets/${selectedTicket.id}`);
      setUsingBackend(true);
      deleted = true;
    } catch {
      if (usingBackend) {
        setNotice(`Unable to delete ${selectedTicket.id}.`);
      } else {
        setUsingBackend(false);
        deleted = true;
      }
    } finally {
      if (deleted) {
        setTickets((current) => {
          const next = current.filter((ticket) => ticket.id !== selectedTicket.id);
          setSelectedTicketId(next[0]?.id ?? '');
          return next;
        });
        setNotice(`${selectedTicket.id} deleted.`);
        setDeleteConfirmOpen(false);
      }
      setDeletingTicket(false);
    }
  };

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Form Handling</h1>
          <p className="text-zinc-400">Non-life-threatening citizen reports - Zendesk-style ticketing</p>
          <p className="mt-1 text-xs text-zinc-600">
            Data mode: {usingBackend ? 'Connected to backend ticket API' : 'Website-only local mode'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="px-2.5 py-1 bg-red-900/50 border border-red-800 text-red-400 rounded-lg">
            {tickets.filter((ticket) => ticket.status === 'open').length} Open
          </span>
          <span className="px-2.5 py-1 bg-blue-900/50 border border-blue-800 text-blue-400 rounded-lg">
            {tickets.filter((ticket) => ticket.status === 'in-progress').length} In Progress
          </span>
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-3 p-3 bg-green-950/50 border border-green-800 rounded-lg text-sm text-green-400">
          <CheckCircle className="w-4 h-4" />
          {notice}
        </div>
      )}

      <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[600px]">
        <div className="w-80 flex-shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-zinc-800 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tickets..."
                className="w-full pl-8 pr-24 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-red-600"
              />
              <button
                type="button"
                onClick={() => setSortMode(nextSortMode(sortMode))}
                title={`Sort: ${sortOptions.find((option) => option.value === sortMode)?.label ?? 'Priority'}`}
                aria-label={`Sort: ${sortOptions.find((option) => option.value === sortMode)?.label ?? 'Priority'}`}
                className="absolute right-1.5 top-1.5 flex h-7 min-w-7 items-center justify-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-1.5 text-xs text-zinc-400 transition-colors hover:border-red-700 hover:text-red-300"
              >
                <ArrowDownUp className="h-3.5 w-3.5" />
                <span className="max-w-12 truncate">{sortIconLabels[sortMode]}</span>
              </button>
            </div>
            <div className="flex gap-1 flex-wrap">
              {statusOptions.map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    filterStatus === status ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
            <select value={filterCrisis} onChange={(event) => setFilterCrisis(event.target.value)} className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-red-600">
              {crisisTypes.map((crisis) => <option key={crisis}>{crisis}</option>)}
            </select>
            <select value={filterAgency} onChange={(event) => setFilterAgency(event.target.value)} className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-red-600">
              {agencies.map((agency) => <option key={agency}>{agency}</option>)}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.map((ticket) => (
              <TicketListItem
                key={ticket.id}
                ticket={ticket}
                selected={selectedTicket?.id === ticket.id}
                onSelect={() => selectTicket(ticket.id)}
              />
            ))}
          </div>
        </div>

        {selectedTicket ? (
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
            <TicketDetailHeader
              ticket={selectedTicket}
              onPing={() => setPingOpen(true)}
              onStart={() => updateStatus(selectedTicket, 'in-progress')}
              onResolve={() => updateStatus(selectedTicket, 'resolved')}
              onDelete={() => setDeleteConfirmOpen(true)}
            />

            <div className="flex flex-1 overflow-hidden">
              <div className="w-56 flex-shrink-0 border-r border-zinc-800 p-4 space-y-4 overflow-y-auto">
                <Property icon={User} label="Reporter" value={selectedTicket.reporter} />
                <Property icon={Clock} label="Timestamp" value={selectedTicket.timestamp} />
                <Property icon={MapPin} label="Location" value={selectedTicket.location} />
                <Property icon={Tag} label="Assigned Agency" value={selectedTicket.assignedAgency} />
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Crisis Type</div>
                  <div className="text-sm text-zinc-300">{selectedTicket.crisisType}</div>
                </div>
                {selectedTicket.hasImage && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Attachment</div>
                    <div className="flex items-center gap-1.5 text-sm text-blue-400"><Image className="w-3.5 h-3.5" />{selectedTicket.images?.length || 1} photo attached</div>
                  </div>
                )}
                {selectedTicket.relatedTickets.length > 0 && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Grouped Reports</div>
                    {selectedTicket.relatedTickets.map((id) => <div key={id} className="text-xs text-purple-400 font-mono">{id}</div>)}
                  </div>
                )}
                {selectedTicket.pingedAgencies.length > 0 && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Pinged Agencies</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedTicket.pingedAgencies.map((agency) => <span key={agency} className="rounded bg-blue-950 px-1.5 py-0.5 text-xs text-blue-400">{agency}</span>)}
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t border-zinc-800">
                  <div className="text-xs text-zinc-500 mb-2">Route to Broadcast</div>
                  <button className="w-full flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 bg-red-950 border border-red-800 text-red-400 rounded-lg hover:bg-red-900 transition-colors">
                    <Radio className="w-3 h-3" />
                    Send to Broadcast
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-5 border-b border-zinc-800">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{selectedTicket.reporter.charAt(0)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{selectedTicket.reporter}</span>
                        <span className="text-xs text-zinc-500">{selectedTicket.timestamp}</span>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed">{selectedTicket.message}</p>
                      {selectedTicket.images?.length ? (
                        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                          <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
                            <Image className="h-3.5 w-3.5" />
                            Attached photo{selectedTicket.images.length > 1 ? 's' : ''}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                          {selectedTicket.images.map((image) =>
                            image.previewUrl ? (
                              <img key={image.id} src={image.previewUrl} alt={image.filename ?? 'Ticket attachment'} className="h-36 w-full rounded-lg border border-zinc-800 object-cover" />
                            ) : (
                              <div key={image.id} className="flex min-h-20 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400">
                                <Image className="h-4 w-4" />
                                <span className="truncate">{image.filename ?? image.storageKey ?? 'Uploaded image'}</span>
                              </div>
                            )
                          )}
                          </div>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500"><MapPin className="w-3 h-3" />{selectedTicket.location}</div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {selectedTicket.comments.length === 0 && <div className="text-sm text-zinc-600">No comments yet.</div>}
                  {groupComments(selectedTicket.comments).map((group) => (
                    <div key={group.id} className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${group.visibility === 'public' ? 'bg-blue-900' : 'bg-red-900'}`}>G</div>
                      <div className="flex-1 bg-zinc-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">{group.author}</span>
                          <span className="text-xs text-zinc-500">{relativeTime(group.createdAt)}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-zinc-700 text-zinc-400 rounded">{group.visibility === 'public' ? 'Public reply' : 'Internal note'}</span>
                        </div>
                        <div className="space-y-2">
                          {group.bodies.map((body, index) => <p key={`${group.id}-${index}`} className="text-sm text-zinc-300">{body}</p>)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {selectedTicketResolved && (
                    <div className="rounded-lg border border-green-800 bg-green-950/30 px-3 py-2 text-sm text-green-300">
                      Ticket resolved. Discussion is closed.
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-zinc-800">
                  <div className="flex gap-2 mb-2">
                    <button disabled={selectedTicketResolved} onClick={() => setCommentType('public')} className={`px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50 ${commentType === 'public' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                      <MessageSquare className="w-3 h-3 inline mr-1" />Public reply
                    </button>
                    <button disabled={selectedTicketResolved} onClick={() => setCommentType('internal')} className={`px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50 ${commentType === 'internal' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                      <Shield className="w-3 h-3 inline mr-1" />Internal note
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      disabled={selectedTicketResolved}
                      placeholder={selectedTicketResolved ? 'Discussion closed after resolution' : commentType === 'public' ? 'Reply to citizen...' : 'Add internal note (not visible to citizen)...'}
                      rows={2}
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-red-600 resize-none disabled:opacity-60"
                    />
                    <button disabled={selectedTicketResolved} onClick={addComment} className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-1 text-sm self-end disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-600">Select a ticket to view details</div>
        )}
      </div>

      {deleteConfirmOpen && selectedTicket && (
        <DeleteTicketDialog
          ticketId={selectedTicket.id}
          deleting={deletingTicket}
          onCancel={() => setDeleteConfirmOpen(false)}
          onConfirm={deleteSelectedTicket}
        />
      )}

      {pingOpen && selectedTicket && (
        <PingAgenciesDialog
          ticketId={selectedTicket.id}
          pinnedAgencies={pinnedAgencies}
          onToggleAgency={(agency) =>
            setPinnedAgencies((previous) => previous.includes(agency) ? previous.filter((item) => item !== agency) : [...previous, agency])
          }
          onCancel={() => setPingOpen(false)}
          onConfirm={pingAgencies}
        />
      )}
    </div>
  );
}

function Property({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="flex items-center gap-1.5 text-sm text-zinc-300"><Icon className="w-3.5 h-3.5 text-zinc-400" />{value}</div>
    </div>
  );
}

function TicketListItem({
  ticket,
  selected,
  onSelect,
}: {
  ticket: Ticket;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 border-b border-zinc-800 hover:bg-zinc-800/60 transition-colors ${selected ? 'bg-zinc-800' : ''}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-zinc-500">{ticket.id}</span>
        <StatusBadge status={ticket.status} />
      </div>
      <div className="text-sm font-medium mb-1 line-clamp-2">{ticket.message}</div>
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ticket.location.split(',')[0]}</span>
        <UrgencyBadge urgency={ticket.urgency} />
      </div>
      <div className="mt-1 text-xs text-zinc-600">{ticket.crisisType} - {ticket.assignedAgency}</div>
    </button>
  );
}

function TicketDetailHeader({
  ticket,
  onPing,
  onStart,
  onResolve,
  onDelete,
}: {
  ticket: Ticket;
  onPing: () => void;
  onStart: () => void;
  onResolve: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-mono text-zinc-400">{ticket.id}</span>
        <StatusBadge status={ticket.status} />
        <UrgencyBadge urgency={ticket.urgency} />
        <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded">{ticket.crisisType}</span>
      </div>
      <div className="flex items-center gap-2">
        {ticket.relatedTickets.length > 0 && (
          <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-purple-950 border border-purple-800 text-purple-400 rounded-lg">
            <Layers className="w-3 h-3" />
            Grouped ({ticket.relatedTickets.length})
          </span>
        )}
        <button onClick={onPing} className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-950 border border-blue-800 text-blue-400 rounded-lg hover:bg-blue-900 transition-colors">
          <Bell className="w-3 h-3" />
          Ping Agencies
        </button>
        <button onClick={onStart} className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-950 border border-blue-800 text-blue-400 rounded-lg hover:bg-blue-900 transition-colors">
          Start Work
        </button>
        <button onClick={onResolve} className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-green-950 border border-green-800 text-green-400 rounded-lg hover:bg-green-900 transition-colors">
          <CheckCircle className="w-3 h-3" />
          Resolve
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 hover:bg-red-950 rounded transition-colors"
          title="Delete ticket"
          aria-label="Delete ticket"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`text-xs px-2 py-0.5 rounded ${statusColors[status]}`}>{status}</span>;
}

function UrgencyBadge({ urgency }: { urgency: TicketUrgency }) {
  return <span className={`px-1.5 py-0.5 text-xs rounded border ${urgencyColors[urgency]}`}>{urgency.toUpperCase()}</span>;
}

function DeleteTicketDialog({
  ticketId,
  deleting,
  onCancel,
  onConfirm,
}: {
  ticketId: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-red-900/70 rounded-xl p-6 w-96 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2 text-red-300"><Trash2 className="w-5 h-5" />Delete Ticket</h3>
          <button disabled={deleting} onClick={onCancel} className="p-1 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"><X className="w-4 h-4 text-zinc-400" /></button>
        </div>
        <p className="text-sm text-zinc-300">
          Delete <span className="font-mono text-red-300">{ticketId}</span>? This removes the ticket and its comments, images, pings, and chat history from the database.
        </p>
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
          This action cannot be undone.
        </div>
        <div className="mt-5 flex gap-2">
          <button disabled={deleting} onClick={onCancel} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors disabled:opacity-50">Cancel</button>
          <button disabled={deleting} onClick={onConfirm} className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PingAgenciesDialog({
  ticketId,
  pinnedAgencies,
  onToggleAgency,
  onCancel,
  onConfirm,
}: {
  ticketId: string;
  pinnedAgencies: string[];
  onToggleAgency: (agency: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-96 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><Bell className="w-5 h-5 text-blue-400" />Ping Related Agencies</h3>
          <button onClick={onCancel} className="p-1 hover:bg-zinc-800 rounded transition-colors"><X className="w-4 h-4 text-zinc-400" /></button>
        </div>
        <p className="text-sm text-zinc-400 mb-4">Selected agencies will receive this ticket ({ticketId}) in their queue and be notified.</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {pingableAgencies.map((agency) => (
            <button
              key={agency}
              onClick={() => onToggleAgency(agency)}
              className={`px-3 py-2 rounded-lg text-sm border transition-colors ${pinnedAgencies.includes(agency) ? 'bg-blue-900 border-blue-700 text-blue-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}
            >
              {agency}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={pinnedAgencies.length === 0} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
            <Send className="w-4 h-4" />
            Ping {pinnedAgencies.length > 0 ? `(${pinnedAgencies.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

async function requestJson<T>(path: string, method: 'POST' | 'PATCH', body: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

async function requestDelete(path: string) {
  const response = await fetch(apiUrl(path), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
}

function updateLocalTickets(updater: (current: Ticket[]) => Ticket[], setTickets: Dispatch<SetStateAction<Ticket[]>>) {
  setTickets((current) => {
    const next = updater(current.length ? current : loadLocalTickets());
    return next;
  });
}

function loadLocalTickets() {
  try {
    const stored = localStorage.getItem('signal-tickets');
    if (!stored) return seedTickets;
    const parsed = JSON.parse(stored) as Ticket[];
    if (!Array.isArray(parsed)) return seedTickets;

    const seedIds = new Set(parsed.map((ticket) => ticket.id));
    return [...parsed, ...seedTickets.filter((ticket) => !seedIds.has(ticket.id))];
  } catch {
    return seedTickets;
  }
}


function createComment(visibility: 'public' | 'internal', body: string): TicketComment {
  return {
    id: crypto.randomUUID(),
    author: 'GOV-HANDLER-001',
    visibility,
    body,
    createdAt: new Date().toISOString(),
  };
}

function commentSeed(visibility: 'public' | 'internal', body: string, minutesAgo: number): TicketComment {
  return {
    ...createComment(visibility, body),
    createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  };
}

type CommentGroup = {
  id: string;
  author: string;
  visibility: 'public' | 'internal';
  createdAt: string;
  bodies: string[];
};

function groupComments(comments: TicketComment[]): CommentGroup[] {
  return comments.reduce<CommentGroup[]>((groups, comment) => {
    const previous = groups.at(-1);
    if (previous && previous.author === comment.author && previous.visibility === comment.visibility) {
      previous.bodies.push(comment.body);
      previous.createdAt = comment.createdAt;
      return groups;
    }

    groups.push({
      id: comment.id,
      author: comment.author,
      visibility: comment.visibility,
      createdAt: comment.createdAt,
      bodies: [comment.body],
    });
    return groups;
  }, []);
}

function isResolved(ticket: Ticket) {
  return ticket.status === 'resolved' || ticket.chatEnabled === false;
}

function sortTickets(a: Ticket, b: Ticket, sortMode: SortMode) {
  if (sortMode === 'priority') {
    const urgencyDifference = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    if (urgencyDifference !== 0) return urgencyDifference;
    return ticketTime(b) - ticketTime(a);
  }

  if (sortMode === 'oldest') return ticketTime(a) - ticketTime(b);
  if (sortMode === 'ticket-number') return ticketNumber(b) - ticketNumber(a);
  return ticketTime(b) - ticketTime(a);
}

function ticketTime(ticket: Ticket) {
  return new Date(ticket.timestamp).getTime();
}

function ticketNumber(ticket: Ticket) {
  const match = ticket.id.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function nextSortMode(sortMode: SortMode): SortMode {
  const index = sortOptions.findIndex((option) => option.value === sortMode);
  return sortOptions[(index + 1) % sortOptions.length].value;
}

function relativeTime(timestamp: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}
