import { Camera, CheckCircle, Info, MapPin, Phone, Search, Send, Shield, Ticket } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { apiUrl } from '../../lib/api';

type CreatedTicket = {
  id: string;
  publicReportId: string;
  status: string;
  assignedAgency: string;
  item?: TicketRecord;
};

type TicketRecord = {
  id: string;
  reporter: string;
  message: string;
  location: string;
  crisisType: string;
  status: string;
  assignedAgency: string;
  urgency: string;
  hasImage: boolean;
};

const publicTicketStorageKey = 'signal-public-opened-tickets';

export default function PublicTickets() {
  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [reporter, setReporter] = useState('');
  const [hasImage, setHasImage] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<CreatedTicket | null>(null);
  const [trackId, setTrackId] = useState('');
  const [trackedTicket, setTrackedTicket] = useState<TicketRecord | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!reportType || !description.trim()) {
      setError('Choose an incident type and describe what happened.');
      return;
    }

    try {
      const response = await fetch(apiUrl('/api/citizen/reports'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporter,
          reportType,
          crisisType: reportType,
          description,
          locationText: location,
          hasImage,
        }),
      });
      if (!response.ok) throw new Error('Backend unavailable');
      const data = (await response.json()) as CreatedTicket;
      setCreatedTicket(data);
      saveLocalTicket(data.item ?? ticketFromCreated(data, { reporter, reportType, description, location, hasImage }));
    } catch {
      const localTicket = createLocalTicket({ reporter, reportType, description, location, hasImage });
      saveLocalTicket(localTicket);
      setCreatedTicket({
        id: localTicket.id,
        publicReportId: localTicket.id,
        status: localTicket.status,
        assignedAgency: localTicket.assignedAgency,
        item: localTicket,
      });
    }

    setDescription('');
    setLocation('');
    setHasImage(false);
  };

  const handleTrack = async () => {
    const normalizedId = trackId.trim().toUpperCase();
    if (!normalizedId) return;
    setError('');

    try {
      const response = await fetch(apiUrl(`/api/citizen/reports/${normalizedId}`));
      if (!response.ok) throw new Error('Report not found');
      const data = await response.json() as { item: TicketRecord };
      setTrackedTicket(data.item);
    } catch {
      const localTicket = loadLocalTickets().find((ticket) => ticket.id === normalizedId);
      if (localTicket) {
        setTrackedTicket(localTicket);
      } else {
        setTrackedTicket(null);
        setError(`Could not find ticket ${normalizedId}.`);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold mb-2">Tickets</h1>
        <p className="text-zinc-400">Open and track non-emergency government tickets</p>
      </div>

      <div className="bg-red-950/40 border border-red-800 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Phone className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-red-300 mb-1">Immediate Life-Threatening Emergency?</div>
            <p className="text-sm text-zinc-300 mb-3">
              Call emergency services directly. Tickets are for non-life-threatening issues.
            </p>
            <div className="flex flex-wrap gap-2">
              <a href="tel:995" className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm font-medium">
                <Phone className="w-4 h-4" />Call 995
              </a>
              <a href="tel:1777" className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors text-sm">
                Non-Emergency: 1777
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-950/20 border border-blue-800/50 rounded-lg px-4 py-3 flex items-start gap-2 text-sm text-zinc-300">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <span>
          Opening a ticket sends it to the government <Link to="/gov/form-handling" className="text-blue-400 hover:underline">Form Handling</Link> queue. The separate <Link to="/public/report" className="text-blue-400 hover:underline">Report</Link> page stays for general incident reporting.
        </span>
      </div>

      {error && <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 text-sm text-red-300">{error}</div>}

      {createdTicket && (
        <div className="bg-green-950/50 border border-green-800 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <div>
              <h3 className="font-semibold text-green-400 mb-1">Ticket Opened</h3>
              <p className="text-sm text-zinc-300">
                Ticket ID: <span className="font-mono font-bold text-white">{createdTicket.publicReportId}</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">Assigned agency: {createdTicket.assignedAgency} · Status: {createdTicket.status}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
          <Ticket className="w-5 h-5 text-red-500" />
          Open Government Ticket
        </h2>
        <div className="space-y-4">
          <input
            value={reporter}
            onChange={(event) => setReporter(event.target.value)}
            placeholder="Your name, optional"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
          />

          <select value={reportType} onChange={(event) => setReportType(event.target.value)} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600">
            <option value="">Select ticket type...</option>
            <option value="flood">Flooding / Water Damage</option>
            <option value="health">Health / Medical Concern</option>
            <option value="supply">Supply Shortage Sighting</option>
            <option value="infrastructure">Infrastructure Issue</option>
            <option value="transport">Transport Disruption</option>
            <option value="environment">Environmental Hazard</option>
            <option value="other">Other / General Ticket</option>
          </select>

          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe the issue for government handlers..."
            rows={5}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
          />

          <div>
            <div className="flex gap-2">
              <input
                type="text"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Enter address, landmark, or postal code..."
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              />
              <button type="button" onClick={() => setLocation('Current location requested')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4" />Auto-Detect
              </button>
            </div>
            <div className="mt-1.5 text-xs text-zinc-500 flex items-center gap-1">
              <Shield className="w-3 h-3" />Location data is used only for response coordination
            </div>
          </div>

          <label className="block border-2 border-dashed border-zinc-700 rounded-lg p-6 text-center hover:border-zinc-600 transition-colors cursor-pointer">
            <Camera className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
            <p className="text-sm text-zinc-400 mb-1">{hasImage ? 'Photo selected' : 'Click to upload photos'}</p>
            <p className="text-xs text-zinc-600">Images help handlers assess the situation quickly</p>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => setHasImage(Boolean(event.target.files?.length))} />
          </label>

          <button onClick={handleSubmit} className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium">
            <Send className="w-4 h-4" />Open Ticket
          </button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="font-semibold mb-3 text-sm">Track Your Ticket</h3>
        <p className="text-sm text-zinc-400 mb-3">Enter your Ticket ID to check its status.</p>
        <div className="flex gap-2">
          <input
            value={trackId}
            onChange={(event) => setTrackId(event.target.value)}
            type="text"
            placeholder="TKT-0042"
            className="min-w-0 flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
          />
          <button onClick={handleTrack} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg">
            <Search className="w-4 h-4" />
          </button>
        </div>
        {trackedTicket && (
          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-300">
            <div className="font-mono text-zinc-100">{trackedTicket.id}</div>
            <div>Status: {trackedTicket.status}</div>
            <div>Agency: {trackedTicket.assignedAgency}</div>
            <div className="mt-1 text-zinc-500">{trackedTicket.message}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function createLocalTicket(input: { reporter: string; reportType: string; description: string; location: string; hasImage: boolean }): TicketRecord {
  return {
    id: nextLocalTicketId(),
    reporter: input.reporter.trim() || 'Citizen (Anonymous)',
    message: input.description.trim(),
    location: input.location.trim() || 'Location not provided',
    crisisType: labelForReportType(input.reportType),
    status: 'open',
    assignedAgency: agencyForReportType(input.reportType),
    urgency: urgencyFor(input.reportType, input.description),
    hasImage: input.hasImage,
  };
}

function ticketFromCreated(data: CreatedTicket, input: { reporter: string; reportType: string; description: string; location: string; hasImage: boolean }): TicketRecord {
  return { ...createLocalTicket(input), id: data.publicReportId, status: data.status, assignedAgency: data.assignedAgency };
}

function saveLocalTicket(ticket: TicketRecord) {
  const tickets = loadLocalTickets().filter((item) => item.id !== ticket.id);
  localStorage.setItem(publicTicketStorageKey, JSON.stringify([ticket, ...tickets]));

  try {
    const govTickets = JSON.parse(localStorage.getItem('signal-tickets') ?? '[]') as Array<Record<string, unknown>>;
    const govTicket = {
      ...ticket,
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      relatedTickets: [],
      comments: [{ id: crypto.randomUUID(), author: 'System', visibility: 'internal', body: 'Opened from public ticket page.', createdAt: new Date().toISOString() }],
      pingedAgencies: [],
    };
    localStorage.setItem('signal-tickets', JSON.stringify([govTicket, ...govTickets.filter((item) => item.id !== ticket.id)]));
  } catch {
    // Tracking still works through publicTicketStorageKey.
  }
}

function loadLocalTickets(): TicketRecord[] {
  try {
    const stored = localStorage.getItem(publicTicketStorageKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as TicketRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function nextLocalTicketId() {
  const highest = loadLocalTickets().reduce((max, ticket) => {
    const number = Number(ticket.id.replace('TKT-', ''));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 42);
  return `TKT-${String(highest + 1).padStart(4, '0')}`;
}

function labelForReportType(value: string) {
  if (value === 'health') return 'Health';
  if (value === 'flood' || value === 'environment') return 'Weather';
  if (value === 'supply') return 'Supply Chain';
  if (value === 'infrastructure' || value === 'transport') return 'Infrastructure';
  return 'General';
}

function agencyForReportType(value: string) {
  if (value === 'health') return 'MOH';
  if (value === 'flood' || value === 'environment') return 'PUB';
  if (value === 'supply') return 'Enterprise SG';
  if (value === 'infrastructure' || value === 'transport') return 'LTA';
  return 'GOV-OPS';
}

function urgencyFor(crisisType: string, message: string): TicketUrgency {
  void crisisType;
  void message;
  return 'medium';
}
