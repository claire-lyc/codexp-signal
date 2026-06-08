// Future endpoints:
// GET /api/volunteers/opportunities
// GET /api/volunteers/applications
// PATCH /api/volunteers/applications/{id}/verify
// POST /api/volunteers/assignments
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, ChevronDown, Clock, Lock, MapPin, Plus, ShieldCheck, UserCheck, Users, X } from 'lucide-react';
import {
  demoVolunteerProfiles,
  opportunityCapacity,
  readVolunteerOpportunities,
  readVolunteerProfile,
  saveCustomVolunteerOpportunities,
  saveVolunteerProfile,
  readVolunteerNotifications,
  saveVolunteerNotifications,
  scoreVolunteerBreakdown,
  scoreVolunteerForOpportunity,
  statusLabel,
  volunteerSkills,
  type VolunteerAssignment,
  type VolunteerNotification,
  type VolunteerOpportunity,
  type VolunteerProfile,
  type VolunteerRoleSlot,
} from '../../lib/volunteerFlow';

type NeedForm = {
  title: string;
  location: string;
  region: string;
  urgency: 'high' | 'medium' | 'low';
  shift: string;
  reportingPoint: string;
  description: string;
  primaryRole: string;
  primaryNeeded: number;
  primarySkills: string[];
  specialRole: string;
  specialNeeded: number;
  specialSkills: string[];
  specialRequirements: string;
};

const agencies = ['LTA', 'MOH', 'PUB', 'SCDF', 'SPF', 'NEA', 'Enterprise SG', 'MSF', 'GOV-ADMIN'];

const emptyNeedForm: NeedForm = {
  title: 'Traffic Diversion Support',
  location: 'Bugis',
  region: 'Central',
  urgency: 'medium',
  shift: 'Today, 16:00-20:00',
  reportingPoint: 'Bugis MRT Exit B command point',
  description: 'Support ground officers with wayfinding, queue control, and public updates around disrupted transport routes.',
  primaryRole: 'Crowd guide',
  primaryNeeded: 8,
  primarySkills: ['Community Outreach'],
  specialRole: 'Mandarin-speaking guide',
  specialNeeded: 2,
  specialSkills: ['Translation', 'Language Support'],
  specialRequirements: 'Must be comfortable giving public directions in Mandarin.',
};

const urgencyColors: Record<string, string> = {
  high: 'border-red-800 bg-red-950/30',
  medium: 'border-yellow-800 bg-yellow-950/30',
  low: 'border-green-800 bg-green-950/30',
};

const urgencyBadge: Record<string, string> = {
  high: 'bg-red-900 text-red-300',
  medium: 'bg-yellow-900 text-yellow-300',
  low: 'bg-green-900 text-green-300',
};

export default function GovVolunteers() {
  const [currentAgency, setCurrentAgency] = useState('LTA');
  const [citizenProfile, setCitizenProfile] = useState<VolunteerProfile | null>(null);
  const [demoProfiles, setDemoProfiles] = useState<VolunteerProfile[]>(demoVolunteerProfiles);
  const [customNeeds, setCustomNeeds] = useState<VolunteerOpportunity[]>(() => readCustomNeeds());
  const [expandedId, setExpandedId] = useState<number | null>(1);
  const [showNeedForm, setShowNeedForm] = useState(false);
  const [needForm, setNeedForm] = useState<NeedForm>(emptyNeedForm);
  const [allocateModal, setAllocateModal] = useState<VolunteerOpportunity | null>(null);
  const [additionalSlots, setAdditionalSlots] = useState(5);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [boardTab, setBoardTab] = useState<'open' | 'full'>('open');
  const [sideTab, setSideTab] = useState<'queue' | 'skills'>('queue');

  const loadCitizenProfile = () => setCitizenProfile(readVolunteerProfile());

  useEffect(() => {
    loadCitizenProfile();
    const refreshNeeds = () => setCustomNeeds(readCustomNeeds());
    window.addEventListener('storage', loadCitizenProfile);
    window.addEventListener('storage', refreshNeeds);
    window.addEventListener('signal-volunteer-updated', loadCitizenProfile);
    window.addEventListener('signal-volunteer-needs-updated', refreshNeeds);
    return () => {
      window.removeEventListener('storage', loadCitizenProfile);
      window.removeEventListener('storage', refreshNeeds);
      window.removeEventListener('signal-volunteer-updated', loadCitizenProfile);
      window.removeEventListener('signal-volunteer-needs-updated', refreshNeeds);
    };
  }, []);

  const allBaseOpportunities = useMemo(() => readVolunteerOpportunities(), [customNeeds]);
  const rawApplicants = useMemo(() => citizenProfile ? [citizenProfile, ...demoProfiles] : demoProfiles, [citizenProfile, demoProfiles]);

  const applicants = useMemo(() => rawApplicants.map((profile) => {
    const bestMatch = allBaseOpportunities
      .map((opportunity) => ({ opportunity, match: scoreVolunteerForOpportunity(profile, opportunity) }))
      .sort((a, b) => b.match - a.match)[0];
    return { ...profile, bestMatch };
  }), [allBaseOpportunities, rawApplicants]);

  const agencyOpportunities = useMemo(
    () => currentAgency === 'GOV-ADMIN' ? allBaseOpportunities : allBaseOpportunities.filter((opportunity) => opportunity.authorisedAgency === currentAgency),
    [allBaseOpportunities, currentAgency],
  );

  const opportunities = useMemo(() => agencyOpportunities.map((opportunity) => {
    const filled = opportunity.volunteers + rawApplicants.reduce((count, profile) => {
      return count + profile.assignments.filter((assignment) => assignment.opportunityId === opportunity.id && assignment.status !== 'declined').length;
    }, 0);

    return {
      ...opportunity,
      filled,
      candidates: rawApplicants
        .filter((profile) => profile.status !== 'completed')
        .map((profile) => ({
          profile,
          match: scoreVolunteerForOpportunity(profile, opportunity),
          breakdown: scoreVolunteerBreakdown(profile, opportunity),
          applied: profile.appliedOpportunityIds.includes(opportunity.id),
          assigned: profile.assignments.find((assignment) => assignment.opportunityId === opportunity.id),
        }))
        .filter((candidate) => candidate.match >= 50 || candidate.applied)
        .sort((a, b) => Number(b.applied) - Number(a.applied) || b.match - a.match),
    };
  }), [agencyOpportunities, rawApplicants]);

  const openOpportunities = opportunities.filter((opportunity) => opportunity.filled < opportunity.needed);
  const fullOpportunities = opportunities.filter((opportunity) => opportunity.filled >= opportunity.needed);
  const visibleOpportunities = boardTab === 'open' ? openOpportunities : fullOpportunities;

  const stats = {
    active: applicants.filter((profile) => profile.status === 'verified' || profile.status === 'assigned' || profile.status === 'checked_in').length + 1244,
    available: applicants.filter((profile) => profile.status === 'verified').length + 381,
    pending: applicants.filter((profile) => profile.status === 'pending_review').length,
    deployed: applicants.filter((profile) => profile.status === 'assigned' || profile.status === 'checked_in').length + 862,
  };

  const verifyVolunteer = (profile: VolunteerProfile) => {
    updateProfile(profile, { status: 'verified' });
    pushActivity(`${profile.name} verified`);
  };

  const makeAssignment = (opportunity: VolunteerOpportunity, role: VolunteerRoleSlot): VolunteerAssignment => ({
    id: `ASN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    opportunityId: opportunity.id,
    roleId: role.id,
    roleTitle: role.title,
    status: 'offered',
    assignedAt: new Date().toISOString(),
    note: role.specialRequirements ? `${role.specialRequirements}. Report to ${opportunity.reportingPoint}` : `Report to ${opportunity.reportingPoint}`,
  });

  const assignVolunteer = (profile: VolunteerProfile, opportunity: VolunteerOpportunity, role: VolunteerRoleSlot) => {
    if (!canAllocate(opportunity)) {
      pushActivity(`${currentAgency} cannot assign ${opportunity.title}`);
      return;
    }

    const assignment = makeAssignment(opportunity, role);

    updateProfile(profile, {
      status: 'assigned',
      appliedOpportunityIds: Array.from(new Set([...profile.appliedOpportunityIds, opportunity.id])),
      assignments: [...profile.assignments.filter((item) => item.opportunityId !== opportunity.id), assignment],
    });
    pushActivity(`${profile.name} assigned: ${role.title}`);
  };

  const callBackSuitablePeople = (opportunity: VolunteerOpportunity, role: VolunteerRoleSlot) => {
    if (!canAllocate(opportunity)) {
      pushActivity(`${currentAgency} cannot call back for ${opportunity.title}`);
      return;
    }

    const suitable = rawApplicants
      .filter((profile) => isSuitableForRole(profile, opportunity, role))
      .filter((profile) => !profile.assignments.some((assignment) => assignment.opportunityId === opportunity.id && assignment.status !== 'declined'))
      .slice(0, Math.max(1, role.needed - role.assigned));

    if (!suitable.length) {
      pushActivity(`No suitable volunteers found for ${role.title}`);
      return;
    }

    const notifications: VolunteerNotification[] = [];
    const assignmentByVolunteer = new Map<string, VolunteerAssignment>();

    suitable.forEach((profile) => {
      const assignment = makeAssignment(opportunity, role);
      assignmentByVolunteer.set(profile.id, assignment);
      notifications.push({
        id: `CB-${Date.now()}-${profile.id}`,
        volunteerId: profile.id,
        opportunityId: opportunity.id,
        roleId: role.id,
        roleTitle: role.title,
        agency: currentAgency,
        message: `${currentAgency} has offered you ${role.title} for ${opportunity.title}. Please accept or reject the assignment.`,
        status: 'sent',
        createdAt: new Date().toISOString(),
      });
    });

    if (citizenProfile && assignmentByVolunteer.has(citizenProfile.id)) {
      const assignment = assignmentByVolunteer.get(citizenProfile.id)!;
      const nextProfile: VolunteerProfile = {
        ...citizenProfile,
        status: 'assigned',
        appliedOpportunityIds: Array.from(new Set([...citizenProfile.appliedOpportunityIds, opportunity.id])),
        assignments: [...citizenProfile.assignments.filter((item) => item.opportunityId !== opportunity.id), assignment],
      };
      saveVolunteerProfile(nextProfile);
      setCitizenProfile(nextProfile);
    }

    setDemoProfiles((current) => current.map((profile) => {
      const assignment = assignmentByVolunteer.get(profile.id);
      if (!assignment) return profile;
      return {
        ...profile,
        status: 'assigned',
        appliedOpportunityIds: Array.from(new Set([...profile.appliedOpportunityIds, opportunity.id])),
        assignments: [...profile.assignments.filter((item) => item.opportunityId !== opportunity.id), assignment],
      };
    }));

    saveVolunteerNotifications([...notifications, ...readVolunteerNotifications()]);
    pushActivity(`Called back ${suitable.length} suitable volunteer${suitable.length > 1 ? 's' : ''} for ${role.title}`);
  };

  const rejectVolunteer = (profile: VolunteerProfile, opportunity: VolunteerOpportunity, role: VolunteerRoleSlot) => {
    const assignment: VolunteerAssignment = {
      id: `ASN-${Date.now()}`,
      opportunityId: opportunity.id,
      roleId: role.id,
      roleTitle: role.title,
      status: 'declined',
      assignedAt: new Date().toISOString(),
      note: `Not selected for ${role.title}.`,
    };
    updateProfile(profile, {
      assignments: [...profile.assignments.filter((item) => item.opportunityId !== opportunity.id), assignment],
    });
    pushActivity(`${profile.name} rejected for ${role.title}`);
  };

  const pushActivity = (item: string) => {
    setActivityLog((current) => [`${new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })} - ${item}`, ...current].slice(0, 6));
  };

  const updateProfile = (profile: VolunteerProfile, patch: Partial<VolunteerProfile>) => {
    const nextProfile = { ...profile, ...patch };
    if (profile.id === citizenProfile?.id) {
      saveVolunteerProfile(nextProfile);
      setCitizenProfile(nextProfile);
      return;
    }
    setDemoProfiles((current) => current.map((item) => item.id === profile.id ? nextProfile : item));
  };

  const addNeed = () => {
    const roleSlots: VolunteerRoleSlot[] = [
      {
        id: `role-${Date.now()}-primary`,
        title: needForm.primaryRole.trim() || 'General volunteer',
        needed: Math.max(1, needForm.primaryNeeded),
        assigned: 0,
        requiredSkills: needForm.primarySkills.length ? needForm.primarySkills : ['Community Outreach'],
      },
    ];

    if (needForm.specialRole.trim()) {
      roleSlots.push({
        id: `role-${Date.now()}-special`,
        title: needForm.specialRole.trim(),
        needed: Math.max(1, needForm.specialNeeded),
        assigned: 0,
        requiredSkills: needForm.specialSkills.length ? needForm.specialSkills : ['Translation'],
        specialRequirements: needForm.specialRequirements.trim() || undefined,
      });
    }

    const needed = roleSlots.reduce((total, role) => total + role.needed, 0);
    const newNeed: VolunteerOpportunity = {
      id: Date.now(),
      title: needForm.title.trim() || 'New Volunteer Need',
      organization: currentAgency,
      location: needForm.location.trim() || 'Singapore',
      region: needForm.region,
      urgency: needForm.urgency,
      volunteers: 0,
      needed,
      requiredSkills: Array.from(new Set(roleSlots.flatMap((role) => role.requiredSkills))),
      shift: needForm.shift.trim() || 'Today',
      reportingPoint: needForm.reportingPoint.trim() || 'Agency command point',
      authorisedAgency: currentAgency,
      description: needForm.description.trim() || 'Agency-created volunteer need.',
      roleSlots,
    };

    const nextCustomNeeds = [newNeed, ...customNeeds];
    setCustomNeeds(nextCustomNeeds);
    saveCustomVolunteerOpportunities(nextCustomNeeds);
    setExpandedId(newNeed.id);
    setBoardTab('open');
    setShowNeedForm(false);
    pushActivity(`${currentAgency} added ${newNeed.title}`);
  };

  const handleAllocate = (opportunity: VolunteerOpportunity) => {
    pushActivity(`${additionalSlots} standby slots opened for ${opportunity.title}`);
    setAllocateModal(null);
  };

  const canAllocate = (opportunity: VolunteerOpportunity) => currentAgency === opportunity.authorisedAgency || currentAgency === 'GOV-ADMIN';

  const isSuitableForRole = (profile: VolunteerProfile, opportunity: VolunteerOpportunity, role: VolunteerRoleSlot) => {
    if (profile.status !== 'verified') return false;
    const score = scoreVolunteerForOpportunity(profile, opportunity);
    const skillHits = role.requiredSkills.filter((skill) => profile.skills.includes(skill)).length;
    const hasNeededSkills = role.specialRequirements ? skillHits === role.requiredSkills.length : skillHits > 0;
    return score >= 60 && hasNeededSkills;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Volunteers & Resources</h1>
          <p className="text-zinc-400">Create needs, verify applicants, call back matching volunteers, and assign roles.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button onClick={() => setShowNeedForm(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            New Need
          </button>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
            <label className="mb-1 block text-xs text-zinc-500">Demo agency</label>
            <select value={currentAgency} onChange={(event) => setCurrentAgency(event.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100">
              {agencies.map((agency) => <option key={agency}>{agency}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric icon={<Users className="h-5 w-5 text-green-500" />} label="Active Volunteers" value={stats.active} badge="Active" />
        <Metric icon={<Clock className="h-5 w-5 text-blue-500" />} label="Available Now" value={stats.available} badge="Available" />
        <Metric icon={<AlertCircle className="h-5 w-5 text-yellow-500" />} label="Pending Review" value={stats.pending} badge="Review" />
        <Metric icon={<UserCheck className="h-5 w-5 text-purple-500" />} label="Currently Deployed" value={stats.deployed} badge="Deployed" />
      </div>

      {showNeedForm && (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 p-5">
          <div>
            <h2 className="font-semibold">Add Agency Volunteer Need</h2>
            <p className="text-sm text-zinc-500">Use roles when one operation needs different volunteer types.</p>
          </div>
          <button onClick={() => setShowNeedForm((value) => !value)} className="rounded-lg bg-zinc-800 p-2 hover:bg-zinc-700">
            {showNeedForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <Field label="Need title" value={needForm.title} onChange={(value) => setNeedForm({ ...needForm, title: value })} />
            <Field label="Location" value={needForm.location} onChange={(value) => setNeedForm({ ...needForm, location: value })} />
            <SelectField label="Region" value={needForm.region} values={['Central', 'North', 'South', 'East', 'West']} onChange={(value) => setNeedForm({ ...needForm, region: value })} />
            <SelectField label="Urgency" value={needForm.urgency} values={['high', 'medium', 'low']} onChange={(value) => setNeedForm({ ...needForm, urgency: value as NeedForm['urgency'] })} />
            <Field label="Shift" value={needForm.shift} onChange={(value) => setNeedForm({ ...needForm, shift: value })} />
            <Field label="Reporting point" value={needForm.reportingPoint} onChange={(value) => setNeedForm({ ...needForm, reportingPoint: value })} />
            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-medium">Description</label>
              <textarea value={needForm.description} onChange={(event) => setNeedForm({ ...needForm, description: event.target.value })} rows={3} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
            </div>
            <RoleBuilder title="Main role" role={needForm.primaryRole} needed={needForm.primaryNeeded} skills={needForm.primarySkills} onRole={(value) => setNeedForm({ ...needForm, primaryRole: value })} onNeeded={(value) => setNeedForm({ ...needForm, primaryNeeded: value })} onSkills={(skills) => setNeedForm({ ...needForm, primarySkills: skills })} />
            <div className="rounded-lg border border-yellow-800/70 bg-yellow-950/20 p-4">
              <RoleBuilder title="Special role" role={needForm.specialRole} needed={needForm.specialNeeded} skills={needForm.specialSkills} onRole={(value) => setNeedForm({ ...needForm, specialRole: value })} onNeeded={(value) => setNeedForm({ ...needForm, specialNeeded: value })} onSkills={(skills) => setNeedForm({ ...needForm, specialSkills: skills })} />
              <label className="mt-3 block text-sm font-medium">Special requirements</label>
              <input value={needForm.specialRequirements} onChange={(event) => setNeedForm({ ...needForm, specialRequirements: event.target.value })} className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
            </div>
            <div className="lg:col-span-2">
              <button onClick={addNeed} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700">
                <Plus className="h-4 w-4" />
                Add Need
              </button>
            </div>
          </div>
      </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Opportunity Assignment Board</h2>
              <p className="text-xs text-zinc-500">{currentAgency === 'GOV-ADMIN' ? 'Showing all agencies.' : `Showing ${currentAgency} needs only.`} Match = skills 50 pts, region 30 pts, availability 20 pts.</p>
            </div>
            <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
              <button onClick={() => setBoardTab('open')} className={`rounded-md px-3 py-1.5 text-sm ${boardTab === 'open' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>Open ({openOpportunities.length})</button>
              <button onClick={() => setBoardTab('full')} className={`rounded-md px-3 py-1.5 text-sm ${boardTab === 'full' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Full ({fullOpportunities.length})</button>
            </div>
          </div>

          {visibleOpportunities.map((opportunity) => (
            <div key={opportunity.id} className={`overflow-hidden rounded-xl border ${urgencyColors[opportunity.urgency]}`}>
              <div className="p-5">
                <button className="w-full text-left" onClick={() => setExpandedId(expandedId === opportunity.id ? null : opportunity.id)}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-3">
                        <span className="font-semibold">{opportunity.title}</span>
                        <span className={`rounded px-2 py-0.5 text-xs ${urgencyBadge[opportunity.urgency]}`}>{opportunity.urgency.toUpperCase()}</span>
                        {!canAllocate(opportunity) && <span className="inline-flex items-center gap-1 text-xs text-zinc-500"><Lock className="h-3 w-3" />Auth: {opportunity.authorisedAgency}</span>}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
                        <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{opportunity.location}</span>
                        <span>{opportunity.filled}/{opportunity.needed} assigned</span>
                        <span>{opportunity.shift}</span>
                      </div>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-zinc-400 transition-transform ${expandedId === opportunity.id ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                <div className="mt-3 h-1.5 rounded-full bg-zinc-800">
                  <div className={`h-1.5 rounded-full ${opportunity.filled >= opportunity.needed ? 'bg-green-500' : opportunity.urgency === 'high' ? 'bg-red-500' : 'bg-yellow-500'}`} style={{ width: `${Math.min(100, (opportunity.filled / opportunity.needed) * 100)}%` }} />
                </div>
                {canAllocate(opportunity) && (
                  <button onClick={() => { setAllocateModal(opportunity); setAdditionalSlots(Math.max(1, opportunity.needed - opportunity.filled)); }} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm transition-colors hover:bg-blue-700">
                    <Plus className="h-4 w-4" />
                    Open Slots
                  </button>
                )}
              </div>

              {expandedId === opportunity.id && (
                <div className="border-t border-zinc-800/60 p-5">
                  <div className="mb-4 space-y-2">
                    {opportunity.roleSlots.map((role) => (
                      <div key={role.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-medium">{role.title}</div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {opportunity.candidates.filter((candidate) => isSuitableForRole(candidate.profile, opportunity, role)).length} suitable verified volunteers
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-xs text-zinc-500">{role.assigned}/{role.needed} role slots</div>
                            {canAllocate(opportunity) && (
                              <button onClick={() => callBackSuitablePeople(opportunity, role)} className="rounded bg-green-700 px-3 py-1.5 text-xs font-medium hover:bg-green-600">
                                Call back suitable people
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {role.requiredSkills.map((skill) => <span key={skill} className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">{skill}</span>)}
                        </div>
                        {role.specialRequirements && <div className="mt-2 text-xs text-yellow-300">Special: {role.specialRequirements}</div>}
                      </div>
                    ))}
                  </div>
                  <div className="mb-3 text-sm font-medium text-zinc-300">Volunteer stack</div>
                  <div className="space-y-2">
                    {opportunity.candidates.map((candidate) => (
                      <CandidateRow
                        key={`${opportunity.id}-${candidate.profile.id}`}
                        candidate={candidate}
                        opportunity={opportunity}
                        canAssign={canAllocate(opportunity)}
                        onVerify={verifyVolunteer}
                        onAssign={assignVolunteer}
                        onReject={rejectVolunteer}
                      />
                    ))}
                    {!opportunity.candidates.length && <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-500">No matched applicants yet.</div>}
                  </div>
                </div>
              )}
            </div>
          ))}
          {!visibleOpportunities.length && <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">No {boardTab === 'open' ? 'open' : 'fully staffed'} opportunities.</div>}
        </div>

        <aside className="space-y-4">
          <RecentActivity items={activityLog} />
          <div className="inline-flex w-full rounded-lg border border-zinc-800 bg-zinc-950 p-1">
            <button onClick={() => setSideTab('queue')} className={`flex-1 rounded-md px-3 py-1.5 text-sm ${sideTab === 'queue' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>Queue</button>
            <button onClick={() => setSideTab('skills')} className={`flex-1 rounded-md px-3 py-1.5 text-sm ${sideTab === 'skills' ? 'bg-yellow-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Skill Verification</button>
          </div>

          {sideTab === 'queue' ? (
            <>
              <h2 className="text-lg font-semibold">Application Queue</h2>
              {applicants.map((profile) => (
                <ApplicantCard key={profile.id} profile={profile} onVerify={verifyVolunteer} />
              ))}
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">Skill Verification</h2>
              {applicants.filter((profile) => profile.status === 'pending_review').map((profile) => (
                <SkillVerificationCard key={profile.id} profile={profile} onVerify={verifyVolunteer} />
              ))}
              {!applicants.some((profile) => profile.status === 'pending_review') && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">No pending skill verification.</div>
              )}
            </>
          )}
        </aside>
      </section>

      {allocateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Open Standby Slots</h3>
              <button onClick={() => setAllocateModal(null)} className="rounded p-1 hover:bg-zinc-800"><X className="h-4 w-4 text-zinc-400" /></button>
            </div>
            <div className="mb-4 rounded-lg bg-zinc-800 p-3 text-sm">
              <div className="font-medium">{allocateModal.title}</div>
              <div className="text-xs text-zinc-400">{allocateModal.location} - {allocateModal.authorisedAgency}</div>
            </div>
            <label className="mb-2 block text-sm font-medium">Additional standby slots</label>
            <div className="mb-4 flex items-center gap-3">
              <button onClick={() => setAdditionalSlots((value) => Math.max(1, value - 1))} className="h-9 w-9 rounded-lg bg-zinc-800 text-lg hover:bg-zinc-700">-</button>
              <span className="w-12 text-center text-2xl font-bold">{additionalSlots}</span>
              <button onClick={() => setAdditionalSlots((value) => value + 1)} className="h-9 w-9 rounded-lg bg-zinc-800 text-lg hover:bg-zinc-700">+</button>
            </div>
            <div className="mb-4 rounded-lg border border-yellow-800 bg-yellow-950/30 p-3 text-xs text-yellow-300">This opens capacity only in demo state. Backend persistence can later store capacity and audit logs.</div>
            <div className="flex gap-2">
              <button onClick={() => setAllocateModal(null)} className="flex-1 rounded-lg bg-zinc-800 py-2 text-sm hover:bg-zinc-700">Cancel</button>
              <button onClick={() => handleAllocate(allocateModal)} className="flex-1 rounded-lg bg-blue-600 py-2 text-sm hover:bg-blue-700">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function readCustomNeeds() {
  return readVolunteerOpportunities().filter((opportunity) => !['MOH', 'Enterprise SG', 'MSF'].includes(opportunity.authorisedAgency));
}

function Metric({ icon, label, value, badge }: { icon: React.ReactNode; label: string; value: number; badge: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="rounded-lg bg-zinc-950 p-2">{icon}</div>
        <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">{badge}</span>
      </div>
      <div className="mb-1 text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-sm text-zinc-400">{label}</div>
    </div>
  );
}

function RecentActivity({ items }: { items: string[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Recent Activity</h2>
        <span className="text-xs text-zinc-500">{items.length ? `${items.length} latest` : 'Quiet'}</span>
      </div>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item} className="rounded-lg bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300">{item}</div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Verifications and assignments will appear here without interrupting the board.</p>
      )}
    </div>
  );
}

function ApplicantCard({
  profile,
  onVerify,
}: {
  profile: VolunteerProfile & { bestMatch: { opportunity: VolunteerOpportunity; match: number } };
  onVerify: (profile: VolunteerProfile) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{profile.name}</div>
          <div className="text-xs text-zinc-500">{profile.id} - {profile.region}</div>
        </div>
        <span className={`rounded px-2 py-1 text-xs ${profile.status === 'pending_review' ? 'bg-yellow-950 text-yellow-300' : profile.status === 'checked_in' ? 'bg-green-950 text-green-300' : 'bg-zinc-800 text-zinc-300'}`}>{statusLabel(profile.status)}</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {profile.skills.slice(0, 4).map((skill) => <span key={skill} className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{skill}</span>)}
      </div>
      <div className="mb-3 text-sm text-zinc-400">Best fit: {profile.bestMatch.opportunity.title} - {profile.bestMatch.match}%</div>
      {profile.status === 'pending_review' ? (
        <button onClick={() => onVerify(profile)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium hover:bg-green-700">
          <ShieldCheck className="h-4 w-4" />
          Verify
        </button>
      ) : (
        <div className="rounded-lg bg-zinc-950/60 px-3 py-2 text-xs text-zinc-500">Eligible for role-level call-back from the assignment board.</div>
      )}
    </div>
  );
}

function SkillVerificationCard({ profile, onVerify }: { profile: VolunteerProfile; onVerify: (profile: VolunteerProfile) => void }) {
  return (
    <div className="rounded-xl border border-yellow-800/70 bg-yellow-950/20 p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{profile.name}</div>
          <div className="text-xs text-zinc-500">{profile.phone} - {profile.email || 'No email'}</div>
        </div>
        <span className="rounded bg-yellow-900 px-2 py-1 text-xs text-yellow-200">review</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {profile.skills.map((skill) => <span key={skill} className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{skill}</span>)}
      </div>
      <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-sm text-zinc-300">
        {profile.certifications || 'No certification notes provided.'}
      </div>
      <button onClick={() => onVerify(profile)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium hover:bg-green-700">
        <ShieldCheck className="h-4 w-4" />
        Verify skills
      </button>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium">{label}</div>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
    </label>
  );
}

function SelectField({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium">{label}</div>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
        {values.map((item) => <option key={item}>{item}</option>)}
      </select>
    </label>
  );
}

function RoleBuilder({
  title,
  role,
  needed,
  skills,
  onRole,
  onNeeded,
  onSkills,
}: {
  title: string;
  role: string;
  needed: number;
  skills: string[];
  onRole: (value: string) => void;
  onNeeded: (value: number) => void;
  onSkills: (skills: string[]) => void;
}) {
  const toggleSkill = (skill: string) => {
    onSkills(skills.includes(skill) ? skills.filter((item) => item !== skill) : [...skills, skill]);
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
      <div className="mb-3 font-medium">{title}</div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
        <Field label="Role title" value={role} onChange={onRole} />
        <label className="block">
          <div className="mb-2 text-sm font-medium">Needed</div>
          <input type="number" min={1} value={needed} onChange={(event) => onNeeded(Number(event.target.value))} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {volunteerSkills.map((skill) => (
          <button key={skill} type="button" onClick={() => toggleSkill(skill)} className={`rounded-full border px-2.5 py-1 text-xs ${skills.includes(skill) ? 'border-blue-500 bg-blue-600/20 text-blue-200' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600'}`}>
            {skill}
          </button>
        ))}
      </div>
    </div>
  );
}

function CandidateRow({
  candidate,
  opportunity,
  canAssign,
  onVerify,
  onAssign,
  onReject,
}: {
  candidate: { profile: VolunteerProfile; match: number; breakdown: { skills: number; region: number; availability: number; total: number }; applied: boolean; assigned?: VolunteerAssignment };
  opportunity: VolunteerOpportunity;
  canAssign: boolean;
  onVerify: (profile: VolunteerProfile) => void;
  onAssign: (profile: VolunteerProfile, opportunity: VolunteerOpportunity, role: VolunteerRoleSlot) => void;
  onReject: (profile: VolunteerProfile, opportunity: VolunteerOpportunity, role: VolunteerRoleSlot) => void;
}) {
  const { profile } = candidate;
  const openRoles = opportunity.roleSlots.filter((role) => role.assigned < role.needed);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-medium">{profile.name}</span>
            {candidate.applied && <span className="rounded bg-blue-950 px-2 py-0.5 text-xs text-blue-300">Applied</span>}
            {candidate.assigned && (
              <span className={`rounded px-2 py-0.5 text-xs ${candidate.assigned.status === 'declined' ? 'bg-red-950 text-red-300' : 'bg-green-950 text-green-300'}`}>
                {candidate.assigned.status === 'declined' ? 'Rejected' : candidate.assigned.roleTitle ?? 'Assigned'} - {candidate.assigned.status}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map((skill) => <span key={skill} className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">{skill}</span>)}
          </div>
          <div className="mt-2 text-xs text-zinc-500">Skills {candidate.breakdown.skills}/50 - Region {candidate.breakdown.region}/30 - Availability {candidate.breakdown.availability}/20</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-400">{candidate.match}% match</span>
          {profile.status === 'pending_review' && <button onClick={() => onVerify(profile)} className="rounded bg-green-600 px-2.5 py-1 text-xs hover:bg-green-700">Verify</button>}
          {!canAssign && <span className="inline-flex items-center gap-1 text-xs text-zinc-600"><Lock className="h-3 w-3" />No permission</span>}
        </div>
      </div>
      {profile.status !== 'pending_review' && canAssign && !candidate.assigned && (
        <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
          {openRoles.map((role) => (
            <div key={role.id} className="rounded-lg bg-zinc-950/50 p-2">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-300">
                  {role.title}
                  {role.specialRequirements ? <span className="ml-2 text-yellow-300">special review</span> : null}
                </span>
                <div className="flex flex-wrap gap-2">
                  {role.specialRequirements && <button onClick={() => onAssign(profile, opportunity, role)} className="rounded bg-blue-600 px-2.5 py-1 text-xs hover:bg-blue-700">Manual assign</button>}
                  <button onClick={() => onReject(profile, opportunity, role)} className="rounded bg-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-600">Reject</button>
                </div>
              </div>
              <div className="text-xs text-zinc-500">Batch call-back is handled from the role header above.</div>
            </div>
          ))}
          {!openRoles.length && <span className="text-xs text-zinc-500">All role slots are filled.</span>}
        </div>
      )}
    </div>
  );
}
