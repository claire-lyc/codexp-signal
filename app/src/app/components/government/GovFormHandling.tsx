// GET /api/tickets?agency=&status=
// POST /api/tickets/{ticketId}/ping-agencies
import { useState } from 'react';
import {
  Search, Filter, MapPin, Clock, AlertCircle, CheckCircle, User, Image,
  ChevronRight, MessageSquare, Send, Users, Bell, MoreHorizontal, X,
  Tag, Layers, Radio, Shield
} from 'lucide-react';

type Ticket = {
  id: string;
  timestamp: string;
  reporter: string;
  message: string;
  location: string;
  crisisType: string;
  status: 'open' | 'in-progress' | 'resolved' | 'grouped';
  assignedAgency: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  hasImage: boolean;
  relatedTickets?: string[];
};

const allTickets: Ticket[] = [
  { id: 'TKT-0041', timestamp: '2026-06-05 14:22', reporter: 'Citizen (Anonymous)', message: 'Panadol Menstrual completely out of stock at Jurong Point Watsons, Unity, and Guardian. Checked 4 outlets in the area.', location: 'Jurong Point, West', crisisType: 'Supply Chain', status: 'open', assignedAgency: 'Enterprise SG', urgency: 'high', hasImage: false, relatedTickets: ['TKT-0038', 'TKT-0039'] },
  { id: 'TKT-0040', timestamp: '2026-06-05 13:55', reporter: 'User #7821', message: 'Flooding at Orchard underpass — water knee-deep. Cars stalling.', location: 'Orchard Road, Central', crisisType: 'Weather', status: 'in-progress', assignedAgency: 'PUB', urgency: 'critical', hasImage: true, relatedTickets: ['TKT-0036'] },
  { id: 'TKT-0039', timestamp: '2026-06-05 13:40', reporter: 'User #3312', message: 'Cannot find Panadol Menstrual anywhere in Tampines Hub area.', location: 'Tampines Hub, East', crisisType: 'Supply Chain', status: 'grouped', assignedAgency: 'Enterprise SG', urgency: 'medium', hasImage: false, relatedTickets: ['TKT-0041'] },
  { id: 'TKT-0038', timestamp: '2026-06-05 13:10', reporter: 'User #5509', message: 'Dengue symptoms visible in family of 3. Requesting health advisory for Bedok North Ave 1.', location: 'Bedok North Ave 1, East', crisisType: 'Health', status: 'open', assignedAgency: 'MOH', urgency: 'high', hasImage: false },
  { id: 'TKT-0037', timestamp: '2026-06-05 11:30', reporter: 'Citizen (Anonymous)', message: 'MRT East-West Line severely delayed at Jurong East station. Platform overcrowded.', location: 'Jurong East MRT, West', crisisType: 'Infrastructure', status: 'resolved', assignedAgency: 'LTA', urgency: 'medium', hasImage: true },
  { id: 'TKT-0036', timestamp: '2026-06-05 10:15', reporter: 'User #2201', message: 'Road flooded at Orchard Road near Ngee Ann City. Traffic at standstill.', location: 'Orchard Road, Central', crisisType: 'Weather', status: 'grouped', assignedAgency: 'PUB', urgency: 'critical', hasImage: true, relatedTickets: ['TKT-0040'] },
];

const agencies = ['All Agencies', 'MOH', 'PUB', 'LTA', 'Enterprise SG', 'SPF', 'SCDF'];
const statusOptions = ['All', 'open', 'in-progress', 'grouped', 'resolved'];
const crisisTypes = ['All', 'Health', 'Weather', 'Supply Chain', 'Infrastructure', 'Cybersecurity'];

const urgencyColors: Record<string, string> = {
  critical: 'bg-red-900 text-red-400 border-red-800',
  high: 'bg-orange-900 text-orange-400 border-orange-800',
  medium: 'bg-yellow-900 text-yellow-400 border-yellow-800',
  low: 'bg-blue-900 text-blue-400 border-blue-800',
};

const statusColors: Record<string, string> = {
  open: 'bg-red-900/40 text-red-400',
  'in-progress': 'bg-blue-900/40 text-blue-400',
  grouped: 'bg-purple-900/40 text-purple-400',
  resolved: 'bg-green-900/40 text-green-400',
};

const statusBorder: Record<string, string> = {
  open: 'border-red-800/40',
  'in-progress': 'border-blue-800/40',
  grouped: 'border-purple-800/40',
  resolved: 'border-zinc-700',
};

const pingableAgencies = ['MOH', 'PUB', 'LTA', 'Enterprise SG', 'SPF', 'SCDF', 'NEA', 'MSF'];

export default function GovFormHandling() {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(allTickets[0]);
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterCrisis, setFilterCrisis] = useState('All');
  const [filterAgency, setFilterAgency] = useState('All Agencies');
  const [comment, setComment] = useState('');
  const [commentType, setCommentType] = useState<'public' | 'internal'>('public');
  const [pingOpen, setPingOpen] = useState(false);
  const [pinnedAgencies, setPinnedAgencies] = useState<string[]>([]);
  const [pingedAgencies, setPingedAgencies] = useState<string[]>([]);
  const [pingSuccess, setPingSuccess] = useState(false);

  const filtered = allTickets.filter((t) => {
    const statusMatch = filterStatus === 'All' || t.status === filterStatus;
    const crisisMatch = filterCrisis === 'All' || t.crisisType === filterCrisis;
    const agencyMatch = filterAgency === 'All Agencies' || t.assignedAgency === filterAgency;
    return statusMatch && crisisMatch && agencyMatch;
  });

  const handlePingAgencies = () => {
    // POST /api/tickets/{ticketId}/ping-agencies
    setPingedAgencies([...pinnedAgencies]);
    setPingSuccess(true);
    setPingOpen(false);
    setTimeout(() => setPingSuccess(false), 3000);
  };

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Form Handling</h1>
          <p className="text-zinc-400">Non-life-threatening citizen reports — Zendesk-style ticketing</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="px-2.5 py-1 bg-red-900/50 border border-red-800 text-red-400 rounded-lg">{allTickets.filter(t => t.status === 'open').length} Open</span>
          <span className="px-2.5 py-1 bg-blue-900/50 border border-blue-800 text-blue-400 rounded-lg">{allTickets.filter(t => t.status === 'in-progress').length} In Progress</span>
        </div>
      </div>

      {pingSuccess && (
        <div className="flex items-center gap-3 p-3 bg-green-950/50 border border-green-800 rounded-lg text-sm text-green-400">
          <CheckCircle className="w-4 h-4" />
          Agencies pinged: {pingedAgencies.join(', ')}. They will receive this ticket in their queue.
        </div>
      )}

      <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[600px]">
        {/* Left panel — ticket list */}
        <div className="w-80 flex-shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
          {/* Search + filters */}
          <div className="p-3 border-b border-zinc-800 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-zinc-500" />
              <input type="text" placeholder="Search tickets…" className="w-full pl-8 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-red-600" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {statusOptions.map((s) => (
                <button key={s} onClick={() => setFilterStatus(s)} className={`px-2 py-0.5 rounded text-xs transition-colors ${filterStatus === s ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                  {s === 'All' ? 'All' : s}
                </button>
              ))}
            </div>
            <select
              value={filterCrisis}
              onChange={(e) => setFilterCrisis(e.target.value)}
              className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-red-600"
            >
              {crisisTypes.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Ticket list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className={`w-full text-left p-3 border-b border-zinc-800 hover:bg-zinc-800/60 transition-colors ${selectedTicket?.id === ticket.id ? 'bg-zinc-800' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-zinc-500">{ticket.id}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[ticket.status]}`}>{ticket.status}</span>
                </div>
                <div className="text-sm font-medium mb-1 line-clamp-2">{ticket.message}</div>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ticket.location.split(',')[0]}</span>
                  <span className={`px-1.5 py-0.5 rounded border ${urgencyColors[ticket.urgency]}`}>{ticket.urgency.toUpperCase()}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-600">{ticket.crisisType} · {ticket.assignedAgency}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Main ticket detail */}
        {selectedTicket ? (
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
            {/* Ticket toolbar */}
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-400">{selectedTicket.id}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${statusColors[selectedTicket.status]}`}>{selectedTicket.status}</span>
                <span className={`text-xs px-2 py-0.5 rounded border ${urgencyColors[selectedTicket.urgency]}`}>{selectedTicket.urgency.toUpperCase()}</span>
                <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded">{selectedTicket.crisisType}</span>
              </div>
              <div className="flex items-center gap-2">
                {selectedTicket.relatedTickets && (
                  <button className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-purple-950 border border-purple-800 text-purple-400 rounded-lg hover:bg-purple-900 transition-colors">
                    <Layers className="w-3 h-3" />
                    Grouped ({selectedTicket.relatedTickets.length})
                  </button>
                )}
                <button
                  onClick={() => setPingOpen(true)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-950 border border-blue-800 text-blue-400 rounded-lg hover:bg-blue-900 transition-colors"
                >
                  <Bell className="w-3 h-3" />
                  Ping Agencies
                </button>
                <button className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-green-950 border border-green-800 text-green-400 rounded-lg hover:bg-green-900 transition-colors">
                  <CheckCircle className="w-3 h-3" />
                  Resolve
                </button>
                <button className="p-1.5 hover:bg-zinc-800 rounded transition-colors">
                  <MoreHorizontal className="w-4 h-4 text-zinc-400" />
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Left detail properties */}
              <div className="w-56 flex-shrink-0 border-r border-zinc-800 p-4 space-y-4 overflow-y-auto">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Reporter</div>
                  <div className="flex items-center gap-1.5 text-sm"><User className="w-3.5 h-3.5 text-zinc-400" />{selectedTicket.reporter}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Timestamp</div>
                  <div className="flex items-center gap-1.5 text-sm text-zinc-300"><Clock className="w-3.5 h-3.5 text-zinc-400" />{selectedTicket.timestamp}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Location</div>
                  <div className="flex items-center gap-1.5 text-sm text-zinc-300"><MapPin className="w-3.5 h-3.5 text-zinc-400" />{selectedTicket.location}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Assigned Agency</div>
                  <div className="flex items-center gap-1.5 text-sm"><Tag className="w-3.5 h-3.5 text-zinc-400" />{selectedTicket.assignedAgency}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Crisis Type</div>
                  <div className="text-sm text-zinc-300">{selectedTicket.crisisType}</div>
                </div>
                {selectedTicket.hasImage && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Attachment</div>
                    <div className="flex items-center gap-1.5 text-sm text-blue-400"><Image className="w-3.5 h-3.5" />Photo attached</div>
                  </div>
                )}
                {selectedTicket.relatedTickets && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Grouped Reports</div>
                    {selectedTicket.relatedTickets.map((id) => (
                      <div key={id} className="text-xs text-purple-400 font-mono">{id}</div>
                    ))}
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

              {/* Ticket body + comments */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Ticket message */}
                <div className="p-5 border-b border-zinc-800">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {selectedTicket.reporter.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{selectedTicket.reporter}</span>
                        <span className="text-xs text-zinc-500">{selectedTicket.timestamp}</span>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed">{selectedTicket.message}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                        <MapPin className="w-3 h-3" />{selectedTicket.location}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comment thread area */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 bg-red-900 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">G</div>
                    <div className="flex-1 bg-zinc-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">GOV-HANDLER-001</span>
                        <span className="text-xs text-zinc-500">2 mins ago</span>
                        <span className="text-xs px-1.5 py-0.5 bg-zinc-700 text-zinc-400 rounded">Internal note</span>
                      </div>
                      <p className="text-sm text-zinc-300">Escalating to {selectedTicket.assignedAgency} for review. Grouped with related reports in the same area.</p>
                    </div>
                  </div>
                </div>

                {/* Comment input — bottom toolbar */}
                <div className="p-4 border-t border-zinc-800">
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setCommentType('public')}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${commentType === 'public' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <MessageSquare className="w-3 h-3 inline mr-1" />Public reply
                    </button>
                    <button
                      onClick={() => setCommentType('internal')}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${commentType === 'internal' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <Shield className="w-3 h-3 inline mr-1" />Internal note
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder={commentType === 'public' ? 'Reply to citizen…' : 'Add internal note (not visible to citizen)…'}
                      rows={2}
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-red-600 resize-none"
                    />
                    <button className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-1 text-sm self-end">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-600">
            Select a ticket to view details
          </div>
        )}
      </div>

      {/* Ping agencies modal */}
      {pingOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-96 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-400" />
                Ping Related Agencies
              </h3>
              <button onClick={() => setPingOpen(false)} className="p-1 hover:bg-zinc-800 rounded transition-colors">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
            <p className="text-sm text-zinc-400 mb-4">
              Selected agencies will receive this ticket ({selectedTicket?.id}) in their queue and be notified.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {pingableAgencies.map((a) => (
                <button
                  key={a}
                  onClick={() => setPinnedAgencies((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a])}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${pinnedAgencies.includes(a) ? 'bg-blue-900 border-blue-700 text-blue-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}
                >
                  {a}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPingOpen(false)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">Cancel</button>
              <button
                onClick={handlePingAgencies}
                disabled={pinnedAgencies.length === 0}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Ping {pinnedAgencies.length > 0 ? `(${pinnedAgencies.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
