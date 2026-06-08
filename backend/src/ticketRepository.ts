export type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'grouped';
export type TicketUrgency = 'critical' | 'high' | 'medium' | 'low';
export type TicketComment = {
  id: string;
  author: string;
  visibility: 'public' | 'internal';
  body: string;
  createdAt: string;
};

export type Ticket = {
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
};

const now = Date.now();

const tickets: Ticket[] = [
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
    comments: [internalNote('Enterprise SG should verify retail stock and supplier ETA.', 7)],
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
    comments: [internalNote('PUB ops notified. Check whether LTA traffic diversion is needed.', 11)],
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
    comments: [publicReply('Thank you. LTA has confirmed service resumed and crowding has cleared.', 140)],
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

export function listTickets(filters: {
  agency?: string;
  status?: string;
  crisisType?: string;
  query?: string;
}) {
  const query = filters.query?.toLowerCase();

  return tickets.filter((ticket) => {
    if (filters.agency && filters.agency !== 'All Agencies' && ticket.assignedAgency !== filters.agency) return false;
    if (filters.status && filters.status !== 'All' && ticket.status !== filters.status) return false;
    if (filters.crisisType && filters.crisisType !== 'All' && ticket.crisisType !== filters.crisisType) return false;
    if (
      query &&
      !ticket.id.toLowerCase().includes(query) &&
      !ticket.message.toLowerCase().includes(query) &&
      !ticket.location.toLowerCase().includes(query) &&
      !ticket.reporter.toLowerCase().includes(query)
    ) {
      return false;
    }
    return true;
  });
}

export function createCitizenTicket(input: {
  reporter?: string;
  message: string;
  location?: string;
  crisisType: string;
  hasImage?: boolean;
  urgency: TicketUrgency;
}) {
  const ticket: Ticket = {
    id: nextTicketId(),
    timestamp: formatTimestamp(new Date()),
    reporter: input.reporter?.trim() || 'Citizen (Anonymous)',
    message: input.message.trim(),
    location: input.location?.trim() || 'Location not provided',
    crisisType: normalizeCrisisType(input.crisisType),
    status: 'open',
    assignedAgency: agencyFor(input.crisisType),
    urgency: input.urgency,
    hasImage: Boolean(input.hasImage),
    relatedTickets: [],
    comments: [internalNote('New citizen report opened from public portal.', 0)],
    pingedAgencies: [],
  };
  tickets.unshift(ticket);
  return ticket;
}

export function updateTicketStatus(id: string, status: TicketStatus) {
  const ticket = tickets.find((item) => item.id === id);
  if (!ticket) return null;
  ticket.status = status;
  ticket.comments.push(internalNote(`Status changed to ${status}.`, 0));
  return ticket;
}

export function addTicketComment(
  id: string,
  input: { body: string; visibility: 'public' | 'internal'; author?: string },
) {
  const ticket = tickets.find((item) => item.id === id);
  if (!ticket) return null;

  const comment: TicketComment = {
    id: crypto.randomUUID(),
    author: input.author?.trim() || 'GOV-HANDLER-001',
    visibility: input.visibility,
    body: input.body.trim(),
    createdAt: new Date().toISOString(),
  };
  ticket.comments.push(comment);
  return ticket;
}

export function pingTicketAgencies(id: string, agencyCodes: string[]) {
  const ticket = tickets.find((item) => item.id === id);
  if (!ticket) return null;

  ticket.pingedAgencies = [...new Set([...ticket.pingedAgencies, ...agencyCodes])];
  ticket.comments.push(internalNote(`Pinged agencies: ${agencyCodes.join(', ')}.`, 0));
  return {
    ticket,
    pingedAgencies: agencyCodes,
    createdAt: new Date().toISOString(),
  };
}

function internalNote(body: string, minutesAgo: number): TicketComment {
  return {
    id: crypto.randomUUID(),
    author: 'GOV-HANDLER-001',
    visibility: 'internal',
    body,
    createdAt: new Date(now - minutesAgo * 60_000).toISOString(),
  };
}

function publicReply(body: string, minutesAgo: number): TicketComment {
  return {
    id: crypto.randomUUID(),
    author: 'GOV-HANDLER-001',
    visibility: 'public',
    body,
    createdAt: new Date(now - minutesAgo * 60_000).toISOString(),
  };
}

function nextTicketId() {
  const max = tickets.reduce((highest, ticket) => {
    const number = Number(ticket.id.replace('TKT-', ''));
    return Number.isFinite(number) ? Math.max(highest, number) : highest;
  }, 0);
  return `TKT-${String(max + 1).padStart(4, '0')}`;
}

function formatTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeCrisisType(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('health') || normalized.includes('medical')) return 'Health';
  if (normalized.includes('flood') || normalized.includes('weather') || normalized.includes('environment')) return 'Weather';
  if (normalized.includes('supply') || normalized.includes('shortage')) return 'Supply Chain';
  if (normalized.includes('transport') || normalized.includes('infrastructure')) return 'Infrastructure';
  if (normalized.includes('cyber')) return 'Cybersecurity';
  return 'General';
}

function agencyFor(crisisType: string) {
  const normalized = normalizeCrisisType(crisisType);
  if (normalized === 'Health') return 'MOH';
  if (normalized === 'Weather') return 'PUB';
  if (normalized === 'Supply Chain') return 'Enterprise SG';
  if (normalized === 'Infrastructure') return 'LTA';
  if (normalized === 'Cybersecurity') return 'CSA';
  return 'GOV-OPS';
}
