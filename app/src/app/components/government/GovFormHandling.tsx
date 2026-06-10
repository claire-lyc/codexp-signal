import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
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
  MoreVertical,
  Plus,
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
  subjectTag?: SubjectTag | null;
  startedWorkAt?: string | null;
  startedWorkBy?: string | null;
  currentHandler?: string | null;
};

type SubjectTag = {
  id: string;
  label: string;
  description: string | null;
  categories: string[];
};

type AuthUser = {
  agencyCode: string | null;
};
type SortMode = 'priority' | 'newest' | 'oldest' | 'ticket-number';
type QueueView = 'active' | 'archive';

const agencies = ['All Agencies', 'MOH', 'PUB', 'LTA', 'Enterprise SG', 'SPF', 'SCDF', 'NEA', 'CSA', 'GOV-OPS'];
const governmentUsers = [
  'All Government Users',
  'Amirah Tan',
  'Daniel Koh',
  'Jolene Lim',
  'Marcus Yeo',
  'Nur Aisyah',
  'Rachel Ong',
  'Sean Lee',
  'Form Handler',
  'Admin',
  'MOH',
  'PUB',
];
const pingableAgencies = ['MOH', 'PUB', 'LTA', 'Enterprise SG', 'SPF', 'SCDF', 'NEA', 'MSF'];
const statusOptions: Array<'All' | TicketStatus> = ['All', 'open', 'in-progress', 'resolved'];
const crisisTypes = ['All', 'Health', 'Weather', 'Supply Chain', 'Infrastructure', 'Cybersecurity'];
const tagCategories = ['health', 'flood', 'supply', 'infrastructure', 'transport', 'environment', 'other'];
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
const urgencyLabels: Record<TicketUrgency, string> = {
  critical: 'Critical priority',
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
};
const statusLabels: Record<TicketStatus, string> = {
  open: 'Open',
  'in-progress': 'In progress',
  grouped: 'Filed',
  resolved: 'Resolved',
};

function seedSubjectTag(label: string, categories: string[]): SubjectTag {
  return {
    id: `seed-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    label,
    description: null,
    categories,
  };
}

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
    subjectTag: seedSubjectTag('Medicine shortage', ['supply']),
    relatedTickets: ['TKT-0039'],
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
    subjectTag: seedSubjectTag('Orchard Road flooding', ['flood', 'transport']),
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
    subjectTag: seedSubjectTag('Medicine shortage', ['supply']),
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
    subjectTag: seedSubjectTag('Dengue symptoms', ['health']),
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
    subjectTag: seedSubjectTag('Orchard Road flooding', ['flood', 'transport']),
    relatedTickets: ['TKT-0040'],
    comments: [],
    pingedAgencies: ['PUB'],
  },
];

const urgencyColors: Record<TicketUrgency, string> = {
  critical: 'bg-red-500/15 text-red-100 border-red-500/80',
  high: 'bg-orange-500/15 text-orange-100 border-orange-500/80',
  medium: 'bg-yellow-500/15 text-yellow-100 border-yellow-500/80',
  low: 'bg-sky-500/15 text-sky-100 border-sky-500/80',
};

const statusColors: Record<TicketStatus, string> = {
  open: 'bg-zinc-800 text-zinc-200 border-zinc-700',
  'in-progress': 'bg-blue-900/40 text-blue-400',
  grouped: 'bg-purple-900/40 text-purple-400',
  resolved: 'bg-green-900/40 text-green-400',
};

export default function GovFormHandling() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>(seedTickets);
  const [selectedTicketId, setSelectedTicketId] = useState(seedTickets[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | TicketStatus>('All');
  const [filterCrisis, setFilterCrisis] = useState('All');
  const [filterAgency, setFilterAgency] = useState('All Agencies');
  const [filterGovernmentUser, setFilterGovernmentUser] = useState('All Government Users');
  const [filterSubjectId, setFilterSubjectId] = useState('All Subjects');
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [queueView, setQueueView] = useState<QueueView>('active');
  const [comment, setComment] = useState('');
  const [commentType, setCommentType] = useState<'public' | 'internal'>('public');
  const [pingOpen, setPingOpen] = useState(false);
  const [pinnedAgencies, setPinnedAgencies] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [usingBackend, setUsingBackend] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingTicket, setDeletingTicket] = useState(false);
  const [subjectTags, setSubjectTags] = useState<SubjectTag[]>([]);
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [createSubjectOpen, setCreateSubjectOpen] = useState(false);
  const [newSubjectLabel, setNewSubjectLabel] = useState('');
  const [newSubjectCategories, setNewSubjectCategories] = useState<string[]>(['other']);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [selectedCaseTicketIds, setSelectedCaseTicketIds] = useState<string[]>([]);

  const availableSubjectTags = useMemo(() => {
    const byId = new Map<string, SubjectTag>();
    subjectTags.forEach((tag) => byId.set(tag.id, tag));
    tickets.forEach((ticket) => {
      if (ticket.subjectTag) byId.set(ticket.subjectTag.id, ticket.subjectTag);
    });
    return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [subjectTags, tickets]);

  const subjectGroupSummaries = useMemo(() => (
    availableSubjectTags.map((tag) => {
      const groupTickets = tickets.filter((ticket) => ticket.subjectTag?.id === tag.id);
      const activeCount = groupTickets.filter((ticket) => !isResolved(ticket)).length;
      const highestUrgency = groupTickets.reduce<TicketUrgency | null>((highest, ticket) => {
        if (!highest || urgencyRank[ticket.urgency] < urgencyRank[highest]) return ticket.urgency;
        return highest;
      }, null);
      return { tag, tickets: groupTickets, activeCount, highestUrgency };
    }).filter((group) => group.tickets.length > 0 || subjectTags.some((tag) => tag.id === group.tag.id))
      .sort((a, b) => {
        const urgencyA = a.highestUrgency ? urgencyRank[a.highestUrgency] : 99;
        const urgencyB = b.highestUrgency ? urgencyRank[b.highestUrgency] : 99;
        return urgencyA - urgencyB || b.activeCount - a.activeCount || a.tag.label.localeCompare(b.tag.label);
      })
  ), [availableSubjectTags, subjectTags, tickets]);

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

    fetch(apiUrl('/api/report-subject-tags'), { headers: authHeaders() })
      .then((response) => response.ok ? response.json() as Promise<{ items: SubjectTag[] }> : Promise.reject())
      .then((data) => {
        if (!active) return;
        setSubjectTags(data.items);
      })
      .catch(() => {
        if (!active) return;
        setSubjectTags([]);
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

  useEffect(() => {
    setSelectedCaseTicketIds([]);
  }, [filterSubjectId]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tickets
      .filter((ticket) => {
        const archiveMatch = queueView === 'archive' ? isResolved(ticket) : !isResolved(ticket);
        const statusMatch = filterStatus === 'All' || ticket.status === filterStatus;
        const crisisMatch = filterCrisis === 'All' || ticket.crisisType === filterCrisis;
        const agencyMatch = filterAgency === 'All Agencies' || ticket.assignedAgency === filterAgency || ticket.pingedAgencies.includes(filterAgency);
        const governmentUserMatch =
          filterGovernmentUser === 'All Government Users' ||
          ticket.currentHandler === filterGovernmentUser ||
          ticket.startedWorkBy === filterGovernmentUser;
        const subjectMatch =
          filterSubjectId === 'All Subjects' ||
          (filterSubjectId === 'Ungrouped' ? !ticket.subjectTag : ticket.subjectTag?.id === filterSubjectId);
        const queryMatch =
          !normalizedQuery ||
          ticket.id.toLowerCase().includes(normalizedQuery) ||
          ticket.message.toLowerCase().includes(normalizedQuery) ||
          ticket.location.toLowerCase().includes(normalizedQuery) ||
          ticket.reporter.toLowerCase().includes(normalizedQuery);
        return archiveMatch && statusMatch && crisisMatch && agencyMatch && governmentUserMatch && subjectMatch && queryMatch;
      })
      .sort((a, b) => sortTickets(a, b, sortMode));
  }, [filterAgency, filterCrisis, filterGovernmentUser, filterStatus, filterSubjectId, query, queueView, sortMode, tickets]);

  const ticketMatchesCurrentScope = (ticket: Ticket, status: 'All' | TicketStatus = filterStatus) => {
    const normalizedQuery = query.trim().toLowerCase();
    const archiveMatch = queueView === 'archive' ? isResolved(ticket) : !isResolved(ticket);
    const statusMatch = status === 'All' || ticket.status === status;
    const crisisMatch = filterCrisis === 'All' || ticket.crisisType === filterCrisis;
    const agencyMatch = filterAgency === 'All Agencies' || ticket.assignedAgency === filterAgency || ticket.pingedAgencies.includes(filterAgency);
    const governmentUserMatch =
      filterGovernmentUser === 'All Government Users' ||
      ticket.currentHandler === filterGovernmentUser ||
      ticket.startedWorkBy === filterGovernmentUser;
    const subjectMatch =
      filterSubjectId === 'All Subjects' ||
      (filterSubjectId === 'Ungrouped' ? !ticket.subjectTag : ticket.subjectTag?.id === filterSubjectId);
    const queryMatch =
      !normalizedQuery ||
      ticket.id.toLowerCase().includes(normalizedQuery) ||
      ticket.message.toLowerCase().includes(normalizedQuery) ||
      ticket.location.toLowerCase().includes(normalizedQuery) ||
      ticket.reporter.toLowerCase().includes(normalizedQuery);
    return archiveMatch && statusMatch && crisisMatch && agencyMatch && governmentUserMatch && subjectMatch && queryMatch;
  };

  const visibleStatusOptions: Array<'All' | TicketStatus> =
    queueView === 'archive' ? ['All', 'resolved'] : statusOptions.filter((status) => status !== 'resolved');

  const statusCounts = useMemo(() => (
    visibleStatusOptions.reduce<Record<string, number>>((counts, status) => {
      counts[status] = tickets.filter((ticket) => ticketMatchesCurrentScope(ticket, status)).length;
      return counts;
    }, {})
  ), [visibleStatusOptions, tickets, query, queueView, filterAgency, filterCrisis, filterGovernmentUser, filterSubjectId]);

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) ?? filtered[0] ?? null;
  const selectedTicketResolved = selectedTicket ? isResolved(selectedTicket) : false;
  const detailNavigatorTickets = filterSubjectId === 'Ungrouped'
    ? tickets.filter((ticket) => !ticket.subjectTag && (queueView === 'archive' ? isResolved(ticket) : !isResolved(ticket)))
    : selectedTicket?.subjectTag
      ? tickets.filter((ticket) => ticket.subjectTag?.id === selectedTicket.subjectTag?.id)
      : filtered;
  const detailNavigatorLabel = filterSubjectId === 'Ungrouped'
    ? 'Ungrouped reports'
    : selectedTicket?.subjectTag
      ? 'Case reports'
      : 'Reports in this view';
  const detailNavigatorIndex = selectedTicket
    ? detailNavigatorTickets.findIndex((ticket) => ticket.id === selectedTicket.id)
    : -1;
  const previousNavigatorTicket = detailNavigatorIndex > 0 ? detailNavigatorTickets[detailNavigatorIndex - 1] : null;
  const nextNavigatorTicket = detailNavigatorIndex >= 0 && detailNavigatorIndex < detailNavigatorTickets.length - 1
    ? detailNavigatorTickets[detailNavigatorIndex + 1]
    : null;
  const selectedSubjectTag = filterSubjectId === 'All Subjects' || filterSubjectId === 'Ungrouped'
    ? null
    : availableSubjectTags.find((tag) => tag.id === filterSubjectId) ?? null;
  const allSelectedCaseTickets = selectedSubjectTag
    ? tickets.filter((ticket) => ticket.subjectTag?.id === selectedSubjectTag.id)
    : [];
  const selectedCaseTickets = selectedSubjectTag
    ? filtered.filter((ticket) => ticket.subjectTag?.id === selectedSubjectTag.id)
    : [];
  const selectedCaseReviewTickets = selectedCaseTickets.filter((ticket) => selectedCaseTicketIds.includes(ticket.id));
  const showingMultiReportReview = selectedCaseReviewTickets.length > 1;

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

  const applyStatusFilter = (status: 'All' | TicketStatus) => {
    setFilterStatus(status);
    setSelectedCaseTicketIds([]);
    const firstMatch = tickets
      .filter((ticket) => ticketMatchesCurrentScope(ticket, status))
      .sort((a, b) => sortTickets(a, b, sortMode))[0];
    if (firstMatch) selectTicket(firstMatch.id);
  };

  const openNavigatorTicket = (ticket: Ticket) => {
    if (ticket.subjectTag) setFilterSubjectId(ticket.subjectTag.id);
    else setFilterSubjectId('Ungrouped');
    setQueueView(isResolved(ticket) ? 'archive' : 'active');
    setFilterStatus('All');
    setSelectedCaseTicketIds([]);
    selectTicket(ticket.id);
  };

  const sendTicketToBroadcast = (ticket: Ticket) => {
    const region = ticket.location.split(',').at(-1)?.trim();
    const draft = {
      sourceTicketId: ticket.id,
      title: `${ticket.crisisType} advisory - ${ticket.location.split(',')[0]}`,
      message: `${ticket.message}\n\nLocation: ${ticket.location}\nReference: ${ticket.id}`,
      severity: ticket.urgency,
      regions: region && region !== ticket.location ? [region] : [],
      agencies: [ticket.assignedAgency],
    };
    window.localStorage.setItem('signal.broadcast.draft', JSON.stringify(draft));
    setNotice(`${ticket.id} copied to Broadcast Centre draft.`);
    navigate('/gov/broadcast?draft=ticket');
  };

  const updateStatus = async (ticket: Ticket, status: TicketStatus) => {
    let updatedTicket: Ticket | null = null;
    try {
      const data = await requestJson<{ item: Ticket }>(`/api/tickets/${ticket.id}/status`, 'PATCH', { status });
      syncTicket(data.item);
      updatedTicket = data.item;
      setUsingBackend(true);
    } catch {
      setUsingBackend(false);
      updateLocalTickets(
        (current) =>
          current.map((item) =>
            item.id === ticket.id
              ? {
                  ...item,
                  status,
                  subjectTag: status === 'resolved' ? null : item.subjectTag,
                  relatedTickets: status === 'resolved' ? [] : item.relatedTickets,
                  comments: [...item.comments, createComment('internal', `Status changed to ${status}.`)],
                }
              : item,
          ),
        setTickets,
      );
      updatedTicket = {
        ...ticket,
        status,
        subjectTag: status === 'resolved' ? null : ticket.subjectTag,
        relatedTickets: status === 'resolved' ? [] : ticket.relatedTickets,
      };
    }
    if (updatedTicket && isResolved(updatedTicket) && queueView === 'active') {
      setSelectedTicketId((current) => {
        if (current !== updatedTicket.id) return current;
        const nextActive = filtered.find((item) => item.id !== updatedTicket.id && !isResolved(item));
        return nextActive?.id ?? '';
      });
    }
    setNotice(`${ticket.id} marked ${status}.`);
  };

  const startWork = async (ticket: Ticket) => {
    try {
      const data = await requestJson<{ item: Ticket }>(`/api/tickets/${ticket.id}/start-work`, 'POST', {});
      syncTicket(data.item);
      setUsingBackend(true);
      setNotice(`Started work on ${ticket.id}.`);
    } catch {
      setUsingBackend(false);
      updateLocalTickets(
        (current) =>
          current.map((item) =>
            item.id === ticket.id
              ? {
                  ...item,
                  status: 'in-progress',
                  startedWorkAt: new Date().toISOString(),
                  currentHandler: 'Current handler',
                  comments: [...item.comments, createComment('internal', 'Work started.')],
                }
              : item,
          ),
        setTickets,
      );
      setNotice(`Started work on ${ticket.id}.`);
    }
  };

  const updateSubjectTag = async (ticket: Ticket, subjectTagId: string | null) => {
    try {
      const data = await requestJson<{ item: Ticket }>(`/api/tickets/${ticket.id}/subject-tag`, 'PATCH', { subjectTagId });
      syncTicket(data.item);
      setUsingBackend(true);
      setNotice(subjectTagId ? `${ticket.id} moved to case.` : `${ticket.id} moved to ungrouped.`);
    } catch {
      setUsingBackend(false);
      const subjectTag = availableSubjectTags.find((tag) => tag.id === subjectTagId) ?? null;
      updateLocalTickets(
        (current) => current.map((item) => item.id === ticket.id ? { ...item, subjectTag } : item),
        setTickets,
      );
      setNotice(subjectTagId ? `${ticket.id} moved to case locally.` : `${ticket.id} moved to ungrouped locally.`);
    } finally {
      setSubjectDialogOpen(false);
      setActionMenuOpen(false);
    }
  };

  const retireSubjectGroup = (subjectTag: SubjectTag) => {
    updateLocalTickets(
      (current) => current.map((ticket) => (
        ticket.subjectTag?.id === subjectTag.id
          ? {
              ...ticket,
              subjectTag: null,
              relatedTickets: [],
              comments: [
                ...ticket.comments,
                createComment('internal', `Case "${subjectTag.label}" closed. Ticket moved back to ungrouped.`),
              ],
            }
          : ticket
      )),
      setTickets,
    );
    setSubjectTags((current) => current.filter((tag) => tag.id !== subjectTag.id));
    if (filterSubjectId === subjectTag.id) setFilterSubjectId('All Subjects');
    setNotice(`Closed case: ${subjectTag.label}.`);
  };

  const createSubjectTag = async () => {
    const label = newSubjectLabel.trim();
    if (!label || newSubjectCategories.length === 0) return;
    try {
      const data = await requestJson<{ item: SubjectTag }>('/api/report-subject-tags', 'POST', {
        label,
        categories: newSubjectCategories,
      });
      setSubjectTags((current) => [data.item, ...current.filter((tag) => tag.id !== data.item.id)]);
      setNewSubjectLabel('');
      setNewSubjectCategories(['other']);
      setCreateSubjectOpen(false);
      if (subjectDialogOpen && selectedTicket) {
        await updateSubjectTag(selectedTicket, data.item.id);
        setSubjectDialogOpen(false);
      }
      setNotice(`Created case: ${data.item.label}.`);
    } catch {
      const localTag: SubjectTag = {
        id: `local-${Date.now()}`,
        label,
        description: null,
        categories: newSubjectCategories,
      };
      setSubjectTags((current) => [localTag, ...current]);
      setNewSubjectLabel('');
      setNewSubjectCategories(['other']);
      setCreateSubjectOpen(false);
      if (subjectDialogOpen && selectedTicket) {
        updateLocalTickets(
          (current) => current.map((item) => item.id === selectedTicket.id ? { ...item, subjectTag: localTag } : item),
          setTickets,
        );
        setSubjectDialogOpen(false);
      }
      setNotice(`Created local case: ${label}.`);
    }
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
          <p className="mt-1 text-xs text-blue-300">
            Currently viewing: {filterCrisis === 'All' ? 'All crisis types' : filterCrisis} &gt; {subjectViewLabel(filterSubjectId, availableSubjectTags)}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="px-2.5 py-1 bg-zinc-900/80 border border-zinc-700 text-zinc-200 rounded-lg">
            {tickets.filter((ticket) => ticket.status === 'open').length} Open
          </span>
          <span className="px-2.5 py-1 bg-blue-900/50 border border-blue-800 text-blue-400 rounded-lg">
            {tickets.filter((ticket) => ticket.status === 'in-progress').length} In Progress
          </span>
          <span className="px-2.5 py-1 bg-green-900/40 border border-green-800 text-green-400 rounded-lg">
            {tickets.filter((ticket) => isResolved(ticket)).length} Archived
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
        <div className="w-64 flex-shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-zinc-800 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tickets..."
                className="w-full pl-8 pr-24 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={() => setSortMode(nextSortMode(sortMode))}
                title={`Sort: ${sortOptions.find((option) => option.value === sortMode)?.label ?? 'Priority'}`}
                aria-label={`Sort: ${sortOptions.find((option) => option.value === sortMode)?.label ?? 'Priority'}`}
                className="absolute right-1.5 top-1.5 flex h-7 min-w-7 items-center justify-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-1.5 text-xs text-zinc-400 transition-colors hover:border-blue-700 hover:text-blue-300"
              >
                <ArrowDownUp className="h-3.5 w-3.5" />
                <span className="max-w-12 truncate">{sortIconLabels[sortMode]}</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
              {(['active', 'archive'] as QueueView[]).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => {
                    setQueueView(view);
                    setFilterStatus('All');
                  }}
                  className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
                    queueView === view ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {view === 'active' ? 'Active queue' : 'Archive'}
                </button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {visibleStatusOptions.map((status) => (
                <button
                  key={status}
                  onClick={() => applyStatusFilter(status)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    filterStatus === status ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {status === 'All' ? 'All' : statusLabels[status]} <span className="text-zinc-500">{statusCounts[status] ?? 0}</span>
                </button>
              ))}
            </div>
            <select value={filterCrisis} onChange={(event) => setFilterCrisis(event.target.value)} className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-600">
              {crisisTypes.map((crisis) => <option key={crisis}>{crisis}</option>)}
            </select>
            <select value={filterAgency} onChange={(event) => setFilterAgency(event.target.value)} className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-600">
              {agencies.map((agency) => <option key={agency}>{agency}</option>)}
            </select>
            <select
              value={filterGovernmentUser}
              onChange={(event) => setFilterGovernmentUser(event.target.value)}
              className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
              aria-label="Filter by government user"
            >
              {governmentUsers.map((user) => <option key={user}>{user}</option>)}
            </select>
            <div className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-950 p-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Case filter</div>
                <button
                  type="button"
                  onClick={() => setCreateSubjectOpen(true)}
                  className="rounded bg-zinc-800 p-1 text-zinc-400 hover:text-white"
                  title="Create case"
                  aria-label="Create case"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <select value={filterSubjectId} onChange={(event) => setFilterSubjectId(event.target.value)} className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-600">
                <option value="All Subjects">All reports</option>
                <option value="Ungrouped">Ungrouped</option>
                {availableSubjectTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.label}</option>)}
              </select>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Case queue</div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setFilterSubjectId('All Subjects')}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    filterSubjectId === 'All Subjects'
                      ? 'border-blue-700 bg-blue-950/40 text-blue-200'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium">All reports</span>
                    <span className="shrink-0 text-[11px] text-zinc-500">{tickets.filter((ticket) => !isResolved(ticket)).length}</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSubjectId('Ungrouped')}
                  className={`w-full rounded-lg border border-dashed px-2.5 py-2 text-left transition-colors ${
                    filterSubjectId === 'Ungrouped'
                      ? 'border-blue-700 bg-blue-950/40 text-blue-200'
                      : 'border-zinc-700 bg-zinc-950/70 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium">Ungrouped</span>
                    <span className="shrink-0 text-[11px] text-zinc-500">{tickets.filter((ticket) => !ticket.subjectTag && !isResolved(ticket)).length}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">Needs case decision</div>
                </button>
                <div className="pt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Cases</div>
                <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1 [scrollbar-color:#3f3f46_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700/70">
                  {subjectGroupSummaries.map((group) => (
                    <button
                      key={group.tag.id}
                      type="button"
                      onClick={() => setFilterSubjectId(group.tag.id)}
                      className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        filterSubjectId === group.tag.id
                          ? 'border-blue-700 bg-blue-950/40 text-blue-200'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium">{group.tag.label}</span>
                        <span className="shrink-0 text-[11px] text-zinc-500">{group.tickets.length}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
                        <span>{group.activeCount} active</span>
                        {group.highestUrgency && <span>{group.highestUrgency}</span>}
                      </div>
                    </button>
                  ))}
                  {!subjectGroupSummaries.length && (
                    <div className="rounded-lg border border-dashed border-zinc-800 px-2.5 py-3 text-xs text-zinc-500">
                      No cases yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filterSubjectId !== 'All Subjects' && (
              <div className="border-b border-zinc-800 bg-zinc-950/60 p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-purple-300" />
                      <div className="truncate text-sm font-semibold text-zinc-100">
                        {filterSubjectId === 'Ungrouped' ? 'Ungrouped' : selectedSubjectTag?.label ?? 'Selected case'}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {filterSubjectId === 'Ungrouped'
                        ? 'Reports that still need to be assigned to a case.'
                        : 'Reports linked to the same operational case.'}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-400">{filtered.length} reports</span>
                    {selectedSubjectTag && (
                      <>
                      <button
                        type="button"
                        onClick={() => setSelectedCaseTicketIds(allSelectedCaseTickets.map((ticket) => ticket.id))}
                        className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
                      >
                        Select all
                      </button>
                      {selectedCaseTicketIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedCaseTicketIds([])}
                          className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => retireSubjectGroup(selectedSubjectTag)}
                        className="rounded-lg border border-red-900/70 bg-red-950/30 px-2.5 py-1.5 text-xs text-red-200 hover:bg-red-950/60"
                      >
                        Close case
                      </button>
                      </>
                    )}
                  </div>
                </div>
                {selectedSubjectTag && (
                  <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/70">
                    <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Reports in this case</div>
                      <div className="text-[11px] text-zinc-500">{allSelectedCaseTickets.length} total</div>
                    </div>
                    <div className="max-h-40 overflow-y-auto p-1.5 [scrollbar-color:#3f3f46_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700/70">
                      {allSelectedCaseTickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          type="button"
                          onClick={() => selectTicket(ticket.id)}
                          className={`mb-1 flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-xs transition-colors last:mb-0 ${
                            selectedTicket?.id === ticket.id
                              ? 'border-blue-700 bg-blue-950/40 text-blue-100'
                              : 'border-transparent bg-zinc-950/50 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                          }`}
                        >
                          <span className="font-mono text-[11px] text-zinc-500">{ticket.id}</span>
                          <UrgencyBadge urgency={ticket.urgency} compact />
                          <span className="min-w-0 flex-1 truncate">{ticket.location}</span>
                          <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                            {statusLabels[ticket.status]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {filtered.map((ticket) => (
              <TicketListItem
                key={ticket.id}
                ticket={ticket}
                selected={selectedTicket?.id === ticket.id}
                selectable={Boolean(selectedSubjectTag)}
                checked={selectedCaseTicketIds.includes(ticket.id)}
                onToggleCheck={() => {
                  setSelectedCaseTicketIds((current) => (
                    current.includes(ticket.id)
                      ? current.filter((id) => id !== ticket.id)
                      : [...current, ticket.id]
                  ));
                }}
                onSelect={() => selectTicket(ticket.id)}
              />
            ))}
          </div>
        </div>

        {showingMultiReportReview ? (
          <MultiReportReview
            tickets={selectedCaseReviewTickets}
            caseLabel={selectedSubjectTag?.label ?? 'Selected case'}
            onOpen={(ticketId) => {
              setSelectedTicketId(ticketId);
              setSelectedCaseTicketIds([]);
            }}
            onClear={() => setSelectedCaseTicketIds([])}
          />
        ) : selectedTicket ? (
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
            <TicketDetailHeader
              ticket={selectedTicket}
              actionMenuOpen={actionMenuOpen}
              onToggleMenu={() => setActionMenuOpen((open) => !open)}
              onGroup={() => {
                setSubjectDialogOpen(true);
                setActionMenuOpen(false);
              }}
              onPing={() => {
                setActionMenuOpen(false);
                setPingOpen(true);
              }}
              onResolve={() => {
                setActionMenuOpen(false);
                updateStatus(selectedTicket, 'resolved');
              }}
              onDelete={() => {
                setActionMenuOpen(false);
                setDeleteConfirmOpen(true);
              }}
            />

            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-950/50 px-5 py-2.5">
              <button
                type="button"
                onClick={() => setSubjectDialogOpen(true)}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Move to another case
              </button>
              {selectedTicket.subjectTag && (
                <>
                  <button
                    type="button"
                    onClick={() => updateSubjectTag(selectedTicket, null)}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                  >
                    Remove from case
                  </button>
                  <button
                    type="button"
                    onClick={() => retireSubjectGroup(selectedTicket.subjectTag!)}
                    className="rounded-lg border border-green-900/70 bg-green-950/30 px-3 py-1.5 text-xs text-green-200 hover:bg-green-950/60"
                  >
                    Mark case done
                  </button>
                </>
              )}
            </div>

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
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Case</div>
                  <div className="text-sm text-zinc-300">{selectedTicket.subjectTag?.label ?? 'Ungrouped'}</div>
                </div>
                {detailNavigatorTickets.length > 1 && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-xs font-medium text-zinc-300">{detailNavigatorLabel}</div>
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                        {Math.max(detailNavigatorIndex + 1, 1)} / {detailNavigatorTickets.length}
                      </span>
                    </div>
                    <div className="mb-2 grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        disabled={!previousNavigatorTicket}
                        onClick={() => previousNavigatorTicket && openNavigatorTicket(previousNavigatorTicket)}
                        className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={!nextNavigatorTicket}
                        onClick={() => nextNavigatorTicket && openNavigatorTicket(nextNavigatorTicket)}
                        className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                    <div className="max-h-40 space-y-1 overflow-y-auto pr-1 [scrollbar-color:#3f3f46_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700/70">
                      {detailNavigatorTickets.map((caseTicket) => (
                        <button
                          key={caseTicket.id}
                          type="button"
                          onClick={() => openNavigatorTicket(caseTicket)}
                          className={`w-full rounded-md border px-2 py-1.5 text-left transition-colors ${
                            selectedTicket.id === caseTicket.id
                              ? 'border-blue-700 bg-blue-950/40 text-blue-100'
                              : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] text-zinc-500">{caseTicket.id}</span>
                            <span className="shrink-0 text-[10px] text-zinc-500">{statusLabels[caseTicket.status]}</span>
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-zinc-400">{caseTicket.location}</div>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedTicket.subjectTag) setFilterSubjectId(selectedTicket.subjectTag.id);
                        else setFilterSubjectId('Ungrouped');
                        setFilterStatus('All');
                        setSelectedCaseTicketIds(detailNavigatorTickets.map((ticket) => ticket.id));
                      }}
                      className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      Select all reports
                    </button>
                  </div>
                )}
                {selectedTicket.startedWorkAt && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Current Handler</div>
                    <div className="text-sm text-zinc-300">{selectedTicket.currentHandler ?? selectedTicket.startedWorkBy ?? 'Started'}</div>
                  </div>
                )}
                {selectedTicket.hasImage && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Attachment</div>
                    <div className="flex items-center gap-1.5 text-sm text-blue-400"><Image className="w-3.5 h-3.5" />{selectedTicket.images?.length || 1} photo attached</div>
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
                  <button onClick={() => sendTicketToBroadcast(selectedTicket)} className="w-full flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 bg-zinc-950 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors">
                    <Radio className="w-3 h-3" />
                    Send to Broadcast
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
                {selectedTicket.status === 'open' && !selectedTicket.startedWorkAt && !selectedTicketResolved && (
                  <div className="border-b border-blue-900/60 bg-blue-950/30 px-5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-blue-200">Start work on this ticket?</div>
                        <div className="text-xs text-blue-300/70">This records you as the current handler and moves the ticket to in progress.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => startWork(selectedTicket)}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-700"
                      >
                        Start work
                      </button>
                    </div>
                  </div>
                )}
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

                <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-4">
                  {selectedTicket.comments.length === 0 && <div className="text-sm text-zinc-600">No comments yet.</div>}
                  {groupComments(selectedTicket.comments).map((group) => (
                    <div key={group.id} className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${group.visibility === 'public' ? 'bg-blue-900' : 'bg-zinc-700'}`}>G</div>
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
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 resize-none disabled:opacity-60"
                    />
                    <button disabled={selectedTicketResolved} onClick={addComment} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1 text-sm self-end disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500">
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

      {subjectDialogOpen && selectedTicket && (
        <SubjectGroupDialog
          ticket={selectedTicket}
          subjectTags={availableSubjectTags}
          tickets={tickets}
          onCreate={() => setCreateSubjectOpen(true)}
          onCancel={() => setSubjectDialogOpen(false)}
          onConfirm={(subjectTagId) => updateSubjectTag(selectedTicket, subjectTagId)}
        />
      )}

      {createSubjectOpen && (
        <CreateSubjectDialog
          label={newSubjectLabel}
          categories={newSubjectCategories}
          onLabelChange={setNewSubjectLabel}
          onToggleCategory={(category) =>
            setNewSubjectCategories((current) =>
              current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
            )
          }
          onCancel={() => setCreateSubjectOpen(false)}
          onConfirm={createSubjectTag}
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

function MultiReportReview({
  tickets,
  caseLabel,
  onOpen,
  onClear,
}: {
  tickets: Ticket[];
  caseLabel: string;
  onOpen: (ticketId: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <div>
          <div className="text-lg font-semibold text-zinc-100">Selected reports</div>
          <div className="mt-1 text-xs text-zinc-500">{tickets.length} reports selected in {caseLabel}</div>
        </div>
        <button type="button" onClick={onClear} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700">
          Clear selection
        </button>
      </div>
      <div className="grid max-h-full gap-3 overflow-y-auto p-5 xl:grid-cols-2 [scrollbar-color:#3f3f46_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700/70">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-xs text-zinc-500">{ticket.id}</div>
                <div className="mt-1 font-semibold text-zinc-100">{ticket.location}</div>
              </div>
              <UrgencyBadge urgency={ticket.urgency} compact />
            </div>
            <p className="line-clamp-4 text-sm leading-6 text-zinc-300">{ticket.message}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="rounded bg-zinc-900 px-2 py-1">{ticket.assignedAgency}</span>
              <span className="rounded bg-zinc-900 px-2 py-1">{ticket.crisisType}</span>
              <span className="rounded bg-zinc-900 px-2 py-1">{ticket.status}</span>
            </div>
            <button type="button" onClick={() => onOpen(ticket.id)} className="mt-4 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Open report
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TicketListItem({
  ticket,
  selected,
  selectable = false,
  checked = false,
  onToggleCheck,
  onSelect,
}: {
  ticket: Ticket;
  selected: boolean;
  selectable?: boolean;
  checked?: boolean;
  onToggleCheck?: () => void;
  onSelect: () => void;
}) {
  return (
    <div className={`flex w-full border-b border-zinc-800 transition-colors hover:bg-zinc-800/60 ${selected ? 'bg-zinc-800' : ''}`}>
      {selectable && (
        <div className="flex shrink-0 items-start px-2.5 py-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggleCheck}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Select ${ticket.id}`}
            className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-900"
          />
        </div>
      )}
      <button
      onClick={onSelect}
      className="min-w-0 flex-1 p-3 text-left"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {ticket.status !== 'resolved' && <UrgencyBadge urgency={ticket.urgency} compact />}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {ticket.status !== 'resolved' && ticket.status !== 'grouped' && ticket.subjectTag && <SubjectGroupBadge label={ticket.subjectTag.label} />}
          <StatusBadge status={ticket.status} label={ticket.status === 'grouped' && ticket.subjectTag ? compactSubjectLabel(ticket.subjectTag.label) : undefined} />
        </div>
      </div>
      <div className="text-xs font-mono text-zinc-500">{ticket.id}</div>
      <div className="mt-1 text-sm font-medium line-clamp-2">{ticket.message}</div>
      <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-zinc-500">
        <span className="shrink-0 rounded bg-zinc-950 px-1.5 py-0.5 text-zinc-300">{ticket.assignedAgency}</span>
        <span className="text-zinc-700">·</span>
        <span className="shrink-0">{ticket.crisisType}</span>
        <span className="text-zinc-700">·</span>
        <span className="flex min-w-0 items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{ticket.location.split(',')[0]}</span>
      </div>
    </button>
    </div>
  );
}

function TicketDetailHeader({
  ticket,
  actionMenuOpen,
  onToggleMenu,
  onGroup,
  onPing,
  onResolve,
  onDelete,
}: {
  ticket: Ticket;
  actionMenuOpen: boolean;
  onToggleMenu: () => void;
  onGroup: () => void;
  onPing: () => void;
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
        <span className="text-xs px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-900 rounded">
          {ticket.subjectTag?.label ?? 'Ungrouped'}
        </span>
      </div>
      <div className="relative flex items-center gap-2">
        {ticket.relatedTickets.length > 0 && (
          <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-purple-950 border border-purple-800 text-purple-400 rounded-lg">
            <Layers className="w-3 h-3" />
            {compactSubjectLabel(ticket.subjectTag?.label ?? 'Grouped')}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleMenu}
          className="rounded-lg border border-zinc-700 bg-zinc-950 p-1.5 text-zinc-300 transition-colors hover:bg-zinc-800"
          title="Ticket actions"
          aria-label="Ticket actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {actionMenuOpen && (
          <div className="absolute right-0 top-full z-40 mt-2 w-52 rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl">
            <ActionMenuButton icon={<Layers className="h-4 w-4" />} label="Move to case" onClick={onGroup} />
            <ActionMenuButton icon={<Bell className="h-4 w-4" />} label="Ping agency" onClick={onPing} />
            <ActionMenuButton icon={<CheckCircle className="h-4 w-4" />} label="Resolve" onClick={onResolve} />
            <ActionMenuButton icon={<Trash2 className="h-4 w-4" />} label="Delete" danger onClick={onDelete} />
          </div>
        )}
      </div>
    </div>
  );
}

function ActionMenuButton({ icon, label, danger = false, onClick }: { icon: React.ReactNode; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        danger ? 'text-red-300 hover:bg-red-950/60' : 'text-zinc-300 hover:bg-zinc-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function StatusBadge({ status, label }: { status: TicketStatus; label?: string }) {
  return <span className={`inline-flex h-6 shrink-0 items-center rounded-md border px-2 text-xs font-medium ${statusColors[status]}`}>{label ?? statusLabels[status]}</span>;
}

function SubjectGroupBadge({ label }: { label: string }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center rounded-md border px-2 text-xs font-medium ${statusColors.grouped}`}>
      {compactSubjectLabel(label)}
    </span>
  );
}

function compactSubjectLabel(label: string) {
  return label.length >= 10 ? `${label.slice(0, 7)}...` : label;
}

function UrgencyBadge({ urgency, compact = false }: { urgency: TicketUrgency; compact?: boolean }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center rounded-md border px-2 text-xs font-medium ${urgencyColors[urgency]}`}>
      {compact ? urgencyLabels[urgency].replace(' priority', '') : urgencyLabels[urgency]}
    </span>
  );
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

function SubjectGroupDialog({
  ticket,
  subjectTags,
  tickets,
  onCreate,
  onCancel,
  onConfirm,
}: {
  ticket: Ticket;
  subjectTags: SubjectTag[];
  tickets: Ticket[];
  onCreate: () => void;
  onCancel: () => void;
  onConfirm: (subjectTagId: string | null) => void;
}) {
  const [selectedSubjectId, setSelectedSubjectId] = useState(ticket.subjectTag?.id ?? '');
  const groupCounts = new Map<string, number>();
  const ticketsByGroup = new Map<string, Ticket[]>();
  tickets.forEach((item) => {
    if (item.subjectTag) {
      groupCounts.set(item.subjectTag.id, (groupCounts.get(item.subjectTag.id) ?? 0) + 1);
      ticketsByGroup.set(item.subjectTag.id, [...(ticketsByGroup.get(item.subjectTag.id) ?? []), item]);
    }
  });
  const groupedTags = subjectTags;
  const selectedLabel = groupedTags.find((tag) => tag.id === selectedSubjectId)?.label ?? 'Ungrouped';
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Layers className="w-5 h-5 text-blue-400" />Move report to case</h3>
            <p className="mt-1 text-xs text-zinc-500">{ticket.id} is currently in <span className="text-zinc-300">{ticket.subjectTag?.label ?? 'Ungrouped'}</span></p>
          </div>
          <button onClick={onCancel} className="p-1 hover:bg-zinc-800 rounded transition-colors"><X className="w-4 h-4 text-zinc-400" /></button>
        </div>
        <div className="px-6 py-5">
        <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-300">
          Selected case: <span className="font-medium text-blue-300">{selectedLabel}</span>
        </div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cases</div>
          <button onClick={onCreate} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700">
            <Plus className="h-3.5 w-3.5" />
            New case
          </button>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1 [scrollbar-color:#3f3f46_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700/70">
          <button
            type="button"
            onClick={() => setSelectedSubjectId('')}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${!selectedSubjectId ? 'border-blue-700 bg-blue-950/40 text-blue-200' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
          >
            <span>
              <span className="block font-medium">Ungrouped</span>
              <span className="mt-0.5 block text-xs text-zinc-500">No case assigned</span>
            </span>
            <span className="text-xs text-zinc-500">{tickets.filter((item) => !item.subjectTag).length} reports</span>
          </button>
          {groupedTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => setSelectedSubjectId(tag.id)}
              className={`flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm ${selectedSubjectId === tag.id ? 'border-blue-700 bg-blue-950/40 text-blue-200' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{tag.label}</span>
                <span className="mt-0.5 block text-xs text-zinc-500">{tag.categories.join(', ') || 'No categories'}</span>
                <span className="mt-1 block truncate text-xs text-zinc-600">
                  {(ticketsByGroup.get(tag.id) ?? []).slice(0, 3).map((item) => item.id).join(', ') || 'No reports assigned yet'}
                </span>
              </span>
              <span className="shrink-0 rounded bg-zinc-950 px-2 py-1 text-xs text-zinc-500">{groupCounts.get(tag.id) ?? 0} reports</span>
            </button>
          ))}
          {!groupedTags.length && (
            <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-950/50 p-4 text-sm text-zinc-500">
              No cases yet. Create a new case and this report will be assigned to it.
            </div>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">Cancel</button>
          <button onClick={() => onConfirm(selectedSubjectId || null)} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors">
            Save case
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

function CreateSubjectDialog({
  label,
  categories,
  onLabelChange,
  onToggleCategory,
  onCancel,
  onConfirm,
}: {
  label: string;
  categories: string[];
  onLabelChange: (value: string) => void;
  onToggleCategory: (category: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-[30rem] max-w-[calc(100vw-2rem)] shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><Plus className="w-5 h-5 text-blue-400" />Create case</h3>
          <button onClick={onCancel} className="p-1 hover:bg-zinc-800 rounded transition-colors"><X className="w-4 h-4 text-zinc-400" /></button>
        </div>
        <input
          value={label}
          onChange={(event) => onLabelChange(event.target.value)}
          placeholder="Case name, e.g. Jurong medicine shortage"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
        />
        <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Linked crisis tags</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {tagCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => onToggleCategory(category)}
              className={`rounded-full border px-3 py-1.5 text-sm ${categories.includes(category) ? 'border-blue-600 bg-blue-950/50 text-blue-200' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">Cancel</button>
          <button disabled={!label.trim() || categories.length === 0} onClick={onConfirm} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm transition-colors">
            Create
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
  const [agencyQuery, setAgencyQuery] = useState('');
  const visibleAgencies = pingableAgencies.filter((agency) => agency.toLowerCase().includes(agencyQuery.trim().toLowerCase()));
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-96 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><Bell className="w-5 h-5 text-blue-400" />Ping Related Agencies</h3>
          <button onClick={onCancel} className="p-1 hover:bg-zinc-800 rounded transition-colors"><X className="w-4 h-4 text-zinc-400" /></button>
        </div>
        <p className="text-sm text-zinc-400 mb-4">Selected agencies will receive this ticket ({ticketId}) in their queue and be notified.</p>
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            value={agencyQuery}
            onChange={(event) => setAgencyQuery(event.target.value)}
            placeholder="Filter agencies..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {visibleAgencies.map((agency) => (
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

function subjectViewLabel(filterSubjectId: string, subjectTags: SubjectTag[]) {
  if (filterSubjectId === 'All Subjects') return 'All reports';
  if (filterSubjectId === 'Ungrouped') return 'Ungrouped';
  return subjectTags.find((tag) => tag.id === filterSubjectId)?.label ?? 'Selected case';
}

function relativeTime(timestamp: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}
