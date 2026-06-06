// GET /api/volunteers/opportunities
// PATCH /api/volunteers/opportunities/{id}/capacity
import { useState } from 'react';
import { Users, MapPin, CheckCircle, Clock, AlertCircle, Lock, Plus, X, ChevronDown } from 'lucide-react';

type Opportunity = {
  id: number;
  type: string;
  region: string;
  urgency: 'high' | 'medium' | 'low';
  volunteers: number;
  needed: number;
  requiredSkills: string[];
  authorisedAgency: string;
  suggestedVolunteers: { name: string; skills: string[]; match: number }[];
};

const opportunities: Opportunity[] = [
  {
    id: 1,
    type: 'Vaccination Centre Support',
    region: 'Jurong West',
    urgency: 'high',
    volunteers: 12,
    needed: 25,
    requiredSkills: ['Healthcare', 'Nursing', 'First Aid'],
    authorisedAgency: 'MOH',
    suggestedVolunteers: [
      { name: 'Tan Wei Lin', skills: ['Healthcare', 'Nursing'], match: 95 },
      { name: 'Priya S.', skills: ['First Aid', 'Healthcare'], match: 91 },
      { name: 'Ahmad R.', skills: ['Nursing', 'Emergency Care'], match: 88 },
    ],
  },
  {
    id: 2,
    type: 'Supply Distribution',
    region: 'Tampines',
    urgency: 'medium',
    volunteers: 8,
    needed: 15,
    requiredSkills: ['Logistics', 'Driving', 'Heavy Lifting'],
    authorisedAgency: 'Enterprise SG',
    suggestedVolunteers: [
      { name: 'Lee Jun Hao', skills: ['Logistics', 'Driving'], match: 92 },
      { name: 'Mohamed F.', skills: ['Driving'], match: 80 },
    ],
  },
  {
    id: 3,
    type: 'Community Welfare Check',
    region: 'Ang Mo Kio',
    urgency: 'low',
    volunteers: 20,
    needed: 20,
    requiredSkills: ['Social Work', 'Communication', 'Language Support'],
    authorisedAgency: 'MSF',
    suggestedVolunteers: [],
  },
];

const aiRecommendations = [
  { task: 'Healthcare volunteers to Jurong West vaccination centre', priority: 'high', volunteers: 13, confidence: 89, agency: 'MOH' },
  { task: 'Logistics support for Panadol distribution in East region', priority: 'medium', volunteers: 7, confidence: 82, agency: 'Enterprise SG' },
];

const urgencyColors: Record<string, string> = {
  high: 'bg-red-950/30 border-red-800',
  medium: 'bg-yellow-950/30 border-yellow-800',
  low: 'bg-green-950/30 border-green-800',
};

const urgencyBadge: Record<string, string> = {
  high: 'bg-red-900 text-red-400',
  medium: 'bg-yellow-900 text-yellow-400',
  low: 'bg-green-900 text-green-400',
};

// Logged-in agency simulation — change to test permissions
const CURRENT_AGENCY = 'MOH';

export default function GovVolunteers() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [allocateModal, setAllocateModal] = useState<Opportunity | null>(null);
  const [additionalSlots, setAdditionalSlots] = useState(5);
  const [allocateSuccess, setAllocateSuccess] = useState<number | null>(null);

  const handleAllocate = (opp: Opportunity) => {
    // PATCH /api/volunteers/opportunities/{id}/capacity
    setAllocateSuccess(opp.id);
    setAllocateModal(null);
    setTimeout(() => setAllocateSuccess(null), 3000);
  };

  const canAllocate = (opp: Opportunity) => CURRENT_AGENCY === opp.authorisedAgency || CURRENT_AGENCY === 'GOV-ADMIN';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Volunteers & Resources</h1>
        <p className="text-zinc-400">Volunteer coordination, skill-matched deployment, and resource allocation</p>
      </div>

      {allocateSuccess && (
        <div className="flex items-center gap-3 p-3 bg-green-950/50 border border-green-800 rounded-lg text-sm text-green-400">
          <CheckCircle className="w-4 h-4" />
          Capacity updated successfully. Volunteer candidates have been notified.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3"><div className="p-2 bg-green-950 rounded-lg"><Users className="w-5 h-5 text-green-500" /></div><span className="text-xs px-2 py-1 bg-green-950 text-green-400 rounded">Active</span></div>
          <div className="text-2xl font-bold mb-1">1,247</div>
          <div className="text-sm text-zinc-400">Active Volunteers</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3"><div className="p-2 bg-blue-950 rounded-lg"><Clock className="w-5 h-5 text-blue-500" /></div><span className="text-xs px-2 py-1 bg-blue-950 text-blue-400 rounded">Available</span></div>
          <div className="text-2xl font-bold mb-1">384</div>
          <div className="text-sm text-zinc-400">Available Now</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3"><div className="p-2 bg-red-950 rounded-lg"><AlertCircle className="w-5 h-5 text-red-500" /></div><span className="text-xs px-2 py-1 bg-red-950 text-red-400 rounded">Pending</span></div>
          <div className="text-2xl font-bold mb-1">18</div>
          <div className="text-sm text-zinc-400">Help Requests</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3"><div className="p-2 bg-purple-950 rounded-lg"><CheckCircle className="w-5 h-5 text-purple-500" /></div><span className="text-xs px-2 py-1 bg-purple-950 text-purple-400 rounded">Deployed</span></div>
          <div className="text-2xl font-bold mb-1">863</div>
          <div className="text-sm text-zinc-400">Currently Deployed</div>
        </div>
      </div>

      {/* Note about citizen sync */}
      <div className="bg-blue-950/20 border border-blue-800/50 rounded-lg px-4 py-3 text-sm text-blue-300 flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
        Citizen volunteer applications auto-sync from the Citizen Volunteer page. No manual upload required.
      </div>

      {/* Opportunity cards with skill suggestions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Volunteer Opportunities</h2>
        <div className="space-y-4">
          {opportunities.map((opp) => (
            <div key={opp.id} className={`rounded-xl border ${urgencyColors[opp.urgency]} overflow-hidden`}>
              <button
                className="w-full text-left p-5"
                onClick={() => setExpandedId(expandedId === opp.id ? null : opp.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold">{opp.type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${urgencyBadge[opp.urgency]}`}>{opp.urgency.toUpperCase()}</span>
                      {!canAllocate(opp) && (
                        <span className="flex items-center gap-1 text-xs text-zinc-500">
                          <Lock className="w-3 h-3" />Auth: {opp.authorisedAgency} only
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-zinc-400">
                      <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{opp.region}</span>
                      <span>{opp.volunteers}/{opp.needed} assigned</span>
                      <span className="flex flex-wrap gap-1">
                        {opp.requiredSkills.map((s) => (
                          <span key={s} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded">{s}</span>
                        ))}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {opp.volunteers < opp.needed && canAllocate(opp) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setAllocateModal(opp); setAdditionalSlots(opp.needed - opp.volunteers); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Allocate More
                      </button>
                    )}
                    <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform ${expandedId === opp.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {/* Fill bar */}
                <div className="mt-3 w-full bg-zinc-800 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${opp.volunteers >= opp.needed ? 'bg-green-500' : opp.urgency === 'high' ? 'bg-red-500' : 'bg-yellow-500'}`}
                    style={{ width: `${Math.min(100, (opp.volunteers / opp.needed) * 100)}%` }}
                  />
                </div>
              </button>

              {/* Expanded: skill-matched volunteer suggestions */}
              {expandedId === opp.id && opp.suggestedVolunteers.length > 0 && (
                <div className="px-5 pb-5 border-t border-zinc-800/50 pt-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Skill-Matched Volunteer Suggestions
                    <span className="text-xs text-zinc-600">(Healthcare-trained prioritised for this role)</span>
                  </h4>
                  <div className="space-y-2">
                    {opp.suggestedVolunteers.map((v, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-zinc-900/60 border border-zinc-700 rounded-lg">
                        <div>
                          <div className="text-sm font-medium">{v.name}</div>
                          <div className="flex gap-1 mt-1">
                            {v.skills.map((s) => (
                              <span key={s} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded">{s}</span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-400">{v.match}% match</span>
                          {canAllocate(opp) ? (
                            <button className="px-2.5 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors">Assign</button>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-zinc-600"><Lock className="w-3 h-3" />No permission</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="bg-gradient-to-r from-blue-950/50 to-purple-950/50 border border-blue-900/50 rounded-xl p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 bg-blue-900/50 rounded-lg"><Users className="w-6 h-6 text-blue-400" /></div>
          <div>
            <h3 className="font-semibold mb-1">Data-Supported Allocation Recommendations</h3>
            <p className="text-sm text-zinc-400">Based on current crisis patterns and volunteer skills distribution</p>
          </div>
        </div>
        <div className="space-y-3">
          {aiRecommendations.map((rec, idx) => (
            <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="font-medium mb-1">{rec.task}</div>
                  <div className="text-xs text-zinc-400">Recommended: {rec.volunteers} volunteers · Auth: {rec.agency}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${rec.priority === 'high' ? 'bg-red-900 text-red-400' : 'bg-yellow-900 text-yellow-400'}`}>{rec.priority.toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Confidence: {rec.confidence}%</span>
                {CURRENT_AGENCY === rec.agency || CURRENT_AGENCY === 'GOV-ADMIN' ? (
                  <button className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors">Approve & Notify</button>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-zinc-600 px-3 py-1 bg-zinc-800 rounded"><Lock className="w-3 h-3" />Requires {rec.agency} authorisation</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-yellow-950/30 border border-yellow-800 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-yellow-400">
            <AlertCircle className="w-4 h-4" />
            Human approval required before volunteer notification. Role-based: only authorised agencies can approve.
          </div>
        </div>
      </div>

      {/* Allocate more modal */}
      {allocateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-96 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Allocate More Volunteers</h3>
              <button onClick={() => setAllocateModal(null)} className="p-1 hover:bg-zinc-800 rounded transition-colors">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
            <div className="mb-4 p-3 bg-zinc-800 rounded-lg text-sm">
              <div className="font-medium mb-1">{allocateModal.type}</div>
              <div className="text-zinc-400 text-xs">{allocateModal.region} · {allocateModal.volunteers}/{allocateModal.needed} currently assigned</div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Additional slots to open</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setAdditionalSlots((n) => Math.max(1, n - 1))} className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-lg font-bold transition-colors">−</button>
                <span className="text-2xl font-bold w-12 text-center">{additionalSlots}</span>
                <button onClick={() => setAdditionalSlots((n) => n + 1)} className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-lg font-bold transition-colors">+</button>
              </div>
              <div className="text-xs text-zinc-500 mt-2">New total: {allocateModal.needed + additionalSlots} slots</div>
            </div>
            <div className="p-3 bg-yellow-950/30 border border-yellow-800 rounded-lg mb-4 text-xs text-yellow-400 flex items-center gap-2">
              <Lock className="w-3 h-3 flex-shrink-0" />
              You are authorised as {CURRENT_AGENCY}. This action will be logged.
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAllocateModal(null)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">Cancel</button>
              <button onClick={() => handleAllocate(allocateModal)} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors">Confirm Allocation</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
