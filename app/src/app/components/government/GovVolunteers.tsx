// Future endpoints:
// GET /api/volunteers/opportunities
// GET /api/volunteers/applications
// PATCH /api/volunteers/applications/{id}/verify
// POST /api/volunteers/assignments
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, Clock, Lock, MapPin, Plus, ShieldCheck, UserCheck, Users, X } from 'lucide-react';
import { apiUrl } from '../../lib/api';
import { authHeaders } from '../../lib/auth';
import {
  demoVolunteerProfiles,
  opportunityCapacity,
  readVolunteerOpportunities,
  readVolunteerProfile,
  saveCustomVolunteerOpportunities,
  saveVolunteerProfile,
  scoreVolunteerBreakdown,
  scoreVolunteerForOpportunity,
  statusLabel,
  volunteerNeedsStorageKey,
  volunteerSkills,
  type VolunteerAssignment,
  type VolunteerOpportunity,
  type VolunteerProfile,
  type VolunteerRoleSlot,
} from '../../lib/volunteerFlow';

type RemoteVolunteerProfile = VolunteerProfile & { userId: string; remote: true };

type StoredAuthUser = {
  role?: string | null;
  username?: string | null;
  displayName?: string | null;
};

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

const agencies = ['All agencies', 'LTA', 'MOH', 'PUB', 'SCDF', 'SPF', 'NEA', 'Enterprise SG', 'MSF'];

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

function hasSkillOverlap(profile: VolunteerProfile, opportunity: VolunteerOpportunity) {
  const required = new Set([
    ...opportunity.requiredSkills,
    ...opportunity.roleSlots.flatMap((role) => role.requiredSkills),
  ]);
  return profile.skills.some((skill) => required.has(skill));
}

function agencyFromStoredUser() {
  if (typeof window === 'undefined') return 'All agencies';
  try {
    const raw = window.localStorage.getItem('signal-current-user');
    if (!raw) return 'All agencies';
    const user = JSON.parse(raw) as StoredAuthUser;
    const candidates = [user.role, user.username, user.displayName].filter(Boolean) as string[];
    const agency = agencies.find((item) => candidates.some((candidate) => candidate.toLowerCase() === item.toLowerCase()));
    if (agency) return agency;
    if (candidates.some((candidate) => candidate.toLowerCase().includes('admin'))) return 'All agencies';
  } catch {
    window.localStorage.removeItem('signal-current-user');
  }
  return 'All agencies';
}

function bestRoleForProfile(profile: VolunteerProfile, opportunity: VolunteerOpportunity) {
  return opportunity.roleSlots.find((role) => role.assigned < role.needed && role.requiredSkills.some((skill) => profile.skills.includes(skill)))
    ?? opportunity.roleSlots.find((role) => role.assigned < role.needed)
    ?? opportunity.roleSlots[0];
}

function activeAssignmentsForRole(profiles: VolunteerProfile[], opportunityId: number, roleId: string) {
  return profiles.flatMap((profile) => (
    profile.assignments
      .filter((assignment) => assignment.opportunityId === opportunityId)
      .filter((assignment) => assignment.roleId === roleId)
      .filter((assignment) => assignment.status !== 'declined')
      .map((assignment) => ({ profile, assignment }))
  ));
}

function acceptedAssignmentsForOpportunity(profiles: VolunteerProfile[], opportunityId: number) {
  return profiles.flatMap((profile) => (
    profile.assignments
      .filter((assignment) => assignment.opportunityId === opportunityId)
      .filter((assignment) => assignment.status === 'accepted' || assignment.status === 'checked_in' || assignment.status === 'completed')
      .map((assignment) => ({ profile, assignment }))
  ));
}

function filledSlotsForRole(profiles: VolunteerProfile[], opportunityId: number, role: VolunteerRoleSlot) {
  return activeAssignmentsForRole(profiles, opportunityId, role.id).length;
}

export default function GovVolunteers() {
  const [currentAgency, setCurrentAgency] = useState(() => agencyFromStoredUser());
  const [citizenProfile, setCitizenProfile] = useState<VolunteerProfile | null>(null);
  const [remoteProfiles, setRemoteProfiles] = useState<RemoteVolunteerProfile[]>([]);
  const [demoProfiles, setDemoProfiles] = useState<VolunteerProfile[]>(demoVolunteerProfiles);
  const [customNeeds, setCustomNeeds] = useState<VolunteerOpportunity[]>(() => readCustomNeeds());
  const [expandedId, setExpandedId] = useState<number | null>(1);
  const [showNeedForm, setShowNeedForm] = useState(false);
  const [needForm, setNeedForm] = useState<NeedForm>(emptyNeedForm);
  const [allocateModal, setAllocateModal] = useState<VolunteerOpportunity | null>(null);
  const [additionalSlots, setAdditionalSlots] = useState(5);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [pageMode, setPageMode] = useState<'assignment' | 'profiles'>('assignment');
  const [boardTab, setBoardTab] = useState<'open' | 'full'>('open');
  const [sideTab, setSideTab] = useState<'queue' | 'skills'>('queue');

  const loadCitizenProfile = () => setCitizenProfile(readVolunteerProfile());
  const loadRemoteProfiles = () =>
    fetch(apiUrl('/api/gov/volunteers/profiles'), { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error('Volunteer profiles unavailable');
        return response.json() as Promise<{ items: Array<{ userId: string; profile: VolunteerProfile }> }>;
      })
      .then((data) => {
        setRemoteProfiles(
          data.items.map((item) => ({
            ...item.profile,
            userId: item.userId,
            remote: true as const,
          })),
        );
      })
      .catch(() => {
        setRemoteProfiles([]);
      });

  useEffect(() => {
    loadCitizenProfile();
    loadRemoteProfiles();
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
  const rawApplicants = useMemo(() => {
    const seen = new Set<string>();
    const combined = [
      ...remoteProfiles,
      ...(citizenProfile ? [citizenProfile] : []),
      ...demoProfiles,
    ].filter((profile) => {
      const key = 'userId' in profile ? profile.userId : profile.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return combined;
  }, [citizenProfile, demoProfiles, remoteProfiles]);

  const applicants = useMemo(() => rawApplicants.map((profile) => {
    const bestMatch = allBaseOpportunities
      .map((opportunity) => ({ opportunity, match: scoreVolunteerForOpportunity(profile, opportunity) }))
      .sort((a, b) => b.match - a.match)[0];
    return { ...profile, bestMatch };
  }), [allBaseOpportunities, rawApplicants]);

  const agencyOpportunities = useMemo(
    () => currentAgency === 'All agencies' ? allBaseOpportunities : allBaseOpportunities.filter((opportunity) => opportunity.authorisedAgency === currentAgency),
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
        .filter((candidate) => (candidate.applied || hasSkillOverlap(candidate.profile, opportunity)) && (candidate.match >= 50 || candidate.applied))
        .sort((a, b) => Number(b.applied) - Number(a.applied) || b.match - a.match),
    };
  }), [agencyOpportunities, rawApplicants]);

  const applicationQueue = useMemo(() => agencyOpportunities.flatMap((opportunity) => (
    rawApplicants
      .filter((profile) => profile.appliedOpportunityIds.includes(opportunity.id))
      .filter((profile) => hasSkillOverlap(profile, opportunity))
      .filter((profile) => !profile.assignments.some((assignment) => assignment.opportunityId === opportunity.id && assignment.status === 'declined'))
      .map((profile) => ({
        profile,
        opportunity,
        match: scoreVolunteerForOpportunity(profile, opportunity),
        assigned: profile.assignments.find((assignment) => assignment.opportunityId === opportunity.id),
      }))
  )).sort((a, b) => Number(Boolean(a.assigned)) - Number(Boolean(b.assigned)) || b.match - a.match), [agencyOpportunities, rawApplicants]);

  const skillVerificationProfiles = useMemo(() => (
    rawApplicants
      .filter((profile) => profile.status === 'pending_review')
      .filter((profile) => currentAgency === 'All agencies' || agencyOpportunities.some((opportunity) => hasSkillOverlap(profile, opportunity)))
      .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))
  ), [agencyOpportunities, currentAgency, rawApplicants]);

  const openOpportunities = opportunities.filter((opportunity) => opportunity.filled < opportunity.needed);
  const fullOpportunities = opportunities.filter((opportunity) => opportunity.filled >= opportunity.needed);
  const visibleOpportunities = boardTab === 'open' ? openOpportunities : fullOpportunities;
  const visibleOpportunityIds = new Set(agencyOpportunities.map((opportunity) => opportunity.id));

  const pendingVerification = applicants.filter((profile) => profile.status === 'pending_review');
  const waitingList = applicants.filter((profile) => profile.status !== 'pending_review' && countPendingApplications(profile, visibleOpportunityIds) > 0);
  const readyPool = applicants.filter((profile) => profile.status === 'verified' && countPendingApplications(profile, visibleOpportunityIds) === 0);
  const deployed = applicants.filter((profile) => profile.status === 'assigned' || profile.status === 'checked_in');

  const stats = {
    ready: readyPool.length,
    pending: pendingVerification.length,
    waiting: waitingList.length,
    deployed: deployed.length,
  };

  const agencyStats = {
    needs: agencyOpportunities.length,
    applications: applicationQueue.length,
    accepted: rawApplicants.reduce((count, profile) => (
      count + profile.assignments.filter((assignment) => {
        const opportunity = agencyOpportunities.find((item) => item.id === assignment.opportunityId);
        return opportunity && (assignment.status === 'accepted' || assignment.status === 'checked_in' || assignment.status === 'completed');
      }).length
    ), 0),
    pendingSkills: skillVerificationProfiles.length,
  };

  const verifyVolunteer = (profile: VolunteerProfile) => {
    updateProfile(profile, { status: 'verified' });
    pushActivity(`${profile.name} verified`);
  };

  const makeAssignment = (opportunity: VolunteerOpportunity, role: VolunteerRoleSlot, status: VolunteerAssignment['status'] = 'offered'): VolunteerAssignment => ({
    id: `ASN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    opportunityId: opportunity.id,
    roleId: role.id,
    roleTitle: role.title,
    status,
    assignedAt: new Date().toISOString(),
    note: role.specialRequirements ? `${role.specialRequirements}. Report to ${opportunity.reportingPoint}` : `Report to ${opportunity.reportingPoint}`,
  });

  const assignVolunteer = (profile: VolunteerProfile, opportunity: VolunteerOpportunity, role: VolunteerRoleSlot) => {
    if (!canAllocate(opportunity)) {
      pushActivity(`${currentAgency} cannot assign ${opportunity.title}`);
      return;
    }

    const assignment = makeAssignment(opportunity, role, 'accepted');

    updateProfile(profile, {
      status: 'assigned',
      appliedOpportunityIds: Array.from(new Set([...profile.appliedOpportunityIds, opportunity.id])),
      assignments: [...profile.assignments.filter((item) => item.opportunityId !== opportunity.id), assignment],
    });
    pushActivity(`${profile.name} accepted for ${role.title}`);
  };

  const notifySuitableVolunteers = (opportunity: VolunteerOpportunity, role: VolunteerRoleSlot) => {
    if (!canAllocate(opportunity)) {
      pushActivity(`${currentAgency} cannot invite volunteers for ${opportunity.title}`);
      return;
    }

    const openSlots = Math.max(0, role.needed - filledSlotsForRole(rawApplicants, opportunity.id, role));
    if (!openSlots) {
      pushActivity(`${role.title} has no open slots left`);
      return;
    }

    const suitable = rawApplicants
      .filter((profile) => isSuitableForRole(profile, opportunity, role))
      .filter((profile) => !profile.assignments.some((assignment) => assignment.opportunityId === opportunity.id && assignment.status !== 'declined'))
      .slice(0, openSlots);

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
    pushActivity(`Notified ${suitable.length} suitable volunteer${suitable.length > 1 ? 's' : ''} for ${role.title}`);
  };

  const fastAcceptableVolunteers = (opportunity: VolunteerOpportunity, role: VolunteerRoleSlot) => {
    const openSlots = Math.max(0, role.needed - filledSlotsForRole(rawApplicants, opportunity.id, role));
    if (!openSlots || role.specialRequirements) return [];

    return rawApplicants
      .filter((profile) => isSuitableForRole(profile, opportunity, role))
      .filter((profile) => !profile.assignments.some((assignment) => assignment.opportunityId === opportunity.id && assignment.status !== 'declined'))
      .slice(0, openSlots);
  };

  const fastAcceptSuitableVolunteers = (opportunity: VolunteerOpportunity, role: VolunteerRoleSlot) => {
    if (!canAllocate(opportunity)) {
      pushActivity(`${currentAgency} cannot accept volunteers for ${opportunity.title}`);
      return;
    }

    if (role.specialRequirements) {
      pushActivity(`${role.title} needs manual review before acceptance`);
      return;
    }

    const suitable = fastAcceptableVolunteers(opportunity, role);

    if (!suitable.length) {
      pushActivity(`No suitable volunteers can be fast accepted for ${role.title}`);
      return;
    }

    const acceptedByVolunteer = new Map<string, VolunteerAssignment>();
    suitable.forEach((profile) => {
      acceptedByVolunteer.set(profile.id, {
        ...makeAssignment(opportunity, role),
        status: 'accepted',
      });
    });

    if (citizenProfile && acceptedByVolunteer.has(citizenProfile.id)) {
      const assignment = acceptedByVolunteer.get(citizenProfile.id)!;
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
      const assignment = acceptedByVolunteer.get(profile.id);
      if (!assignment) return profile;
      return {
        ...profile,
        status: 'assigned',
        appliedOpportunityIds: Array.from(new Set([...profile.appliedOpportunityIds, opportunity.id])),
        assignments: [...profile.assignments.filter((item) => item.opportunityId !== opportunity.id), assignment],
      };
    }));

    pushActivity(`Fast accepted ${suitable.length} suitable volunteer${suitable.length > 1 ? 's' : ''} for ${role.title}`);
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
    if ('userId' in profile) {
      setRemoteProfiles((current) => current.map((item) => (item.userId === profile.userId ? { ...item, ...patch } : item)));
      fetch(apiUrl(`/api/gov/volunteers/profiles/${profile.userId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(patch),
      }).catch(() => {
        // Keep local optimistic state even if backend sync is temporarily unavailable.
      });
      return;
    }
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

  const canAllocate = (opportunity: VolunteerOpportunity) => currentAgency === 'All agencies' || currentAgency === opportunity.authorisedAgency;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Volunteers & Resources</h1>
          <p className="text-zinc-400">Review volunteer profiles, create needs, notify suitable volunteers, and assign accepted roles.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button onClick={() => setShowNeedForm(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            New
          </button>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
            <label className="mb-1 block text-xs text-zinc-500">Agency filter</label>
            <select value={currentAgency} onChange={(event) => setCurrentAgency(event.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100">
              {agencies.map((agency) => <option key={agency}>{agency}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric icon={<Clock className="h-5 w-5 text-blue-500" />} label="Ready Now" value={stats.ready} badge="Ready" />
        <Metric icon={<AlertCircle className="h-5 w-5 text-yellow-500" />} label="Pending Verification" value={stats.pending} badge="Review" />
        <Metric icon={<Users className="h-5 w-5 text-orange-500" />} label="Waiting List" value={stats.waiting} badge="Manual" />
        <Metric icon={<UserCheck className="h-5 w-5 text-purple-500" />} label="Deployed" value={stats.deployed} badge="Live" />
      </div>

      <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
        <button onClick={() => setPageMode('assignment')} className={`rounded-md px-3 py-1.5 text-sm ${pageMode === 'assignment' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>Opportunity Assignment</button>
        <button onClick={() => setPageMode('profiles')} className={`rounded-md px-3 py-1.5 text-sm ${pageMode === 'profiles' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Volunteer Profiles & Certs</button>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{currentAgency} Volunteer Workspace</h2>
            <p className="text-sm text-zinc-500">These figures are scoped to the selected agency and the needs shown below.</p>
          </div>
          <span className="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-300">{currentAgency === 'All agencies' ? 'All agencies' : 'Agency view'}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <AgencyStat label="Open Needs" value={agencyStats.needs} />
          <AgencyStat label="Applications" value={agencyStats.applications} />
          <AgencyStat label="Accepted" value={agencyStats.accepted} />
          <AgencyStat label="Skill Review" value={agencyStats.pendingSkills} />
        </div>
      </section>

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

      {pageMode === 'assignment' ? (
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Opportunity Assignment Board</h2>
              <p className="text-xs text-zinc-500">{currentAgency === 'All agencies' ? 'Showing all agencies.' : `Showing ${currentAgency} needs only.`} Volunteers who match a role can be accepted directly; everyone else stays on the queue for review.</p>
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
                    {opportunity.roleSlots.map((role) => {
                      const filledSlots = filledSlotsForRole(rawApplicants, opportunity.id, role);
                      const openSlots = Math.max(0, role.needed - filledSlots);
                      const fastCandidates = fastAcceptableVolunteers(opportunity, role);

                      return (
                        <div key={role.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-medium">{role.title}</div>
                              <div className="mt-1 text-xs text-zinc-500">
                                {opportunity.candidates.filter((candidate) => isSuitableForRole(candidate.profile, opportunity, role)).length} suitable verified volunteers
                              </div>
                            </div>
                            <div className="flex flex-wrap items-start justify-end gap-2">
                              <div className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-right text-xs text-zinc-400">
                                <div>{openSlots} open / {role.needed} total</div>
                                <div className="text-zinc-600">{filledSlots} accepted or offered</div>
                              </div>
                              {canAllocate(opportunity) && (
                                <>
                                  {!role.specialRequirements && (
                                    <FastAcceptDropdown
                                      candidates={fastCandidates}
                                      onAccept={() => fastAcceptSuitableVolunteers(opportunity, role)}
                                    />
                                  )}
                                  <button onClick={() => notifySuitableVolunteers(opportunity, role)} className="rounded bg-green-700 px-3 py-1.5 text-xs font-medium hover:bg-green-600">
                                    Notify suitable volunteers
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {role.requiredSkills.map((skill) => <span key={skill} className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">{skill}</span>)}
                          </div>
                          {role.specialRequirements && <div className="mt-2 text-xs text-yellow-300">Special: {role.specialRequirements}</div>}
                        </div>
                      );
                    })}
                  </div>
                  <AcceptedVolunteers opportunity={opportunity} profiles={rawApplicants} />
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
                    {!opportunity.candidates.length && <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-500">No applicants or suitable volunteers yet.</div>}
                  </div>
                </div>
              )}
            </div>
          ))}
          {!visibleOpportunities.length && <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">No {boardTab === 'open' ? 'open' : 'fully staffed'} opportunities.</div>}
        </div>

        <aside className="space-y-4">
          <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
            <button onClick={() => setSideTab('queue')} className={`rounded-md px-3 py-1.5 text-sm ${sideTab === 'queue' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>Queue</button>
            <button onClick={() => setSideTab('skills')} className={`rounded-md px-3 py-1.5 text-sm ${sideTab === 'skills' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Skill Review</button>
          </div>
          {sideTab === 'queue' ? (
            <>
              <h2 className="text-lg font-semibold">Application Queue</h2>
              <p className="text-sm text-zinc-500">Only applications for {currentAgency === 'All agencies' ? 'visible agency needs' : `${currentAgency} needs`} are shown.</p>
              {applicationQueue.map((item) => (
                <ApplicantCard
                  key={`${item.opportunity.id}-${item.profile.id}`}
                  item={item}
                  onOffer={(profile, opportunity) => assignVolunteer(profile, opportunity, bestRoleForProfile(profile, opportunity))}
                  onReject={(profile, opportunity) => rejectVolunteer(profile, opportunity, opportunity.roleSlots[0])}
                />
              ))}
              {!applicationQueue.length && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">No relevant applications for this agency.</div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">Skill Verification</h2>
              <p className="text-sm text-zinc-500">
                {currentAgency === 'All agencies'
                  ? 'Admin can verify pending volunteer identities and skills.'
                  : 'Agencies see pending volunteers only when their claimed skills fit this agency needs.'}
              </p>
              {skillVerificationProfiles.map((profile) => (
                <SkillVerificationCard key={profile.id} profile={profile} canVerify={currentAgency === 'All agencies'} onVerify={verifyVolunteer} />
              ))}
              {!skillVerificationProfiles.length && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">No relevant pending skill verification.</div>
              )}
            </>
          )}
          <RecentActivity items={activityLog} />
        </aside>
      </section>
      ) : (
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <ActionSection
            title="Pending profile approval"
            description="Review submitted skills, contact details, and certification notes before moving volunteers into the live pool."
            emptyMessage="No volunteer profiles are awaiting approval."
          >
            {pendingVerification.map((profile) => (
              <SkillVerificationCard key={profile.id} profile={profile} canVerify onVerify={verifyVolunteer} />
            ))}
          </ActionSection>
        </div>
        <aside className="space-y-4">
          <ActionSection
            title="Verified volunteers"
            description="Approved volunteers stay searchable here even when they are not currently on the waiting list."
            emptyMessage="No verified volunteer profiles yet."
          >
            {readyPool.concat(deployed).slice(0, 8).map((profile) => (
              <VolunteerProfileCard key={profile.id} profile={profile} />
            ))}
          </ActionSection>
          <RecentActivity items={activityLog} />
        </aside>
      </section>
      )}

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
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(volunteerNeedsStorageKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as VolunteerOpportunity[];
  } catch {
    window.localStorage.removeItem(volunteerNeedsStorageKey);
    return [];
  }
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

function ActionSection({
  title,
  description,
  emptyMessage,
  children,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children].filter(Boolean);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      {items.length ? <div className="space-y-3">{children}</div> : <div className="rounded-lg bg-zinc-950/60 px-3 py-3 text-sm text-zinc-500">{emptyMessage}</div>}
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

function AgencyStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function VolunteerProfileCard({ profile }: { profile: VolunteerProfile }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{profile.name}</div>
          <div className="text-xs text-zinc-500">{profile.phone} - {profile.email || 'No email'}</div>
        </div>
        <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{statusLabel(profile.status)}</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {profile.skills.slice(0, 5).map((skill) => <span key={skill} className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{skill}</span>)}
      </div>
      <div className="text-xs text-zinc-500">{profile.region} - {profile.availability.join(', ') || 'Availability not stated'}</div>
      <div className="mt-2 rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-400">{profile.certifications || 'No certification notes provided.'}</div>
    </div>
  );
}

function FastAcceptDropdown({ candidates, onAccept }: { candidates: VolunteerProfile[]; onAccept: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-1.5 rounded bg-blue-700 px-3 py-1.5 text-xs font-medium hover:bg-blue-600">
        Fast accept
        <span className="rounded bg-blue-950 px-1.5 py-0.5 text-[10px] text-blue-200">{candidates.length}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-zinc-700 bg-zinc-950 p-3 shadow-xl">
          <div className="mb-2 text-xs font-medium text-zinc-300">Volunteers to accept now</div>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {candidates.map((profile) => (
              <div key={profile.id} className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-2">
                <div className="text-sm font-medium text-zinc-100">{profile.name}</div>
                <div className="text-xs text-zinc-500">{profile.region} - {profile.availability.join(', ') || 'Availability not stated'}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {profile.skills.slice(0, 3).map((skill) => <span key={skill} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">{skill}</span>)}
                </div>
              </div>
            ))}
            {!candidates.length && <div className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-xs text-zinc-500">No eligible volunteers for the remaining open slots.</div>}
          </div>
          <button
            onClick={() => {
              onAccept();
              setOpen(false);
            }}
            disabled={!candidates.length}
            className="mt-3 w-full rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            Accept {candidates.length} volunteer{candidates.length === 1 ? '' : 's'}
          </button>
        </div>
      )}
    </div>
  );
}

function AcceptedVolunteers({ opportunity, profiles }: { opportunity: VolunteerOpportunity; profiles: VolunteerProfile[] }) {
  const [open, setOpen] = useState(false);
  const accepted = acceptedAssignmentsForOpportunity(profiles, opportunity.id);

  return (
    <div className="mb-4 rounded-lg border border-green-900/60 bg-green-950/10">
      <button onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <div>
          <div className="text-sm font-medium text-green-200">Accepted volunteers</div>
          <div className="text-xs text-zinc-500">{accepted.length} accepted for {opportunity.title}</div>
        </div>
        <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-green-900/40 p-3">
          {accepted.map(({ profile, assignment }) => (
            <AcceptedVolunteerRow key={`${profile.id}-${assignment.id}`} profile={profile} assignment={assignment} />
          ))}
          {!accepted.length && <div className="rounded-lg bg-zinc-950/60 px-3 py-2 text-sm text-zinc-500">No accepted volunteers yet.</div>}
        </div>
      )}
    </div>
  );
}

function AcceptedVolunteerRow({ profile, assignment }: { profile: VolunteerProfile; assignment: VolunteerAssignment }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60">
      <button onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left">
        <div>
          <div className="text-sm font-medium">{profile.name}</div>
          <div className="text-xs text-zinc-500">{assignment.roleTitle ?? 'Volunteer role'} - {assignment.status}</div>
        </div>
        <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-zinc-800 px-3 py-3 text-sm text-zinc-300">
          <div>{profile.phone} {profile.email ? `- ${profile.email}` : ''}</div>
          <div className="text-xs text-zinc-500">{profile.region} - {profile.availability.join(', ') || 'Availability not stated'}</div>
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map((skill) => <span key={skill} className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">{skill}</span>)}
          </div>
          <div className="rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-400">{profile.certifications || 'No certification notes.'}</div>
        </div>
      )}
    </div>
  );
}

function ApplicantCard({
  item,
  onOffer,
  onReject,
}: {
  item: { profile: VolunteerProfile; opportunity: VolunteerOpportunity; match: number; assigned?: VolunteerAssignment };
  onOffer: (profile: VolunteerProfile, opportunity: VolunteerOpportunity) => void;
  onReject: (profile: VolunteerProfile, opportunity: VolunteerOpportunity) => void;
}) {
  const { profile, opportunity, assigned, match } = item;
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
      <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm">
        <div className="font-medium">{opportunity.title}</div>
        <div className="text-xs text-zinc-500">{opportunity.location} - {opportunity.shift}</div>
        <div className="mt-2 text-xs text-green-400">{match}% fit for this need</div>
      </div>
      {assigned ? (
        <div className={`rounded-lg px-3 py-2 text-xs ${assigned.status === 'declined' ? 'bg-red-950 text-red-300' : 'bg-green-950 text-green-300'}`}>
          {assigned.status === 'declined' ? 'Rejected' : `${assigned.roleTitle ?? 'Assigned'} - ${assigned.status}`}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <button onClick={() => onOffer(profile, opportunity)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Offer Role
          </button>
          <button onClick={() => onReject(profile, opportunity)} className="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-600">
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

function SkillVerificationCard({ profile, canVerify, onVerify }: { profile: VolunteerProfile; canVerify: boolean; onVerify: (profile: VolunteerProfile) => void }) {
  const [open, setOpen] = useState(false);

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
      <button onClick={() => setOpen((value) => !value)} className="mb-3 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700">
        {open ? 'Hide details' : 'Open details'}
      </button>
      {open && (
        <div className="mb-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-sm text-zinc-300">
          <div>
            <div className="mb-1 text-xs uppercase text-zinc-500">Experience / cert notes</div>
            <div>{profile.certifications || 'No certification notes provided.'}</div>
          </div>
          <div>
            <div className="mb-1 text-xs uppercase text-zinc-500">Availability</div>
            <div>{profile.availability.join(', ') || 'Not stated'}</div>
          </div>
          <div>
            <div className="mb-1 text-xs uppercase text-zinc-500">Emergency contact</div>
            <div>{profile.emergencyContact || 'Not provided'}</div>
          </div>
        </div>
      )}
      {canVerify ? (
        <button onClick={() => onVerify(profile)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium hover:bg-green-700">
          <ShieldCheck className="h-4 w-4" />
          Verify person
        </button>
      ) : (
        <div className="rounded-lg bg-zinc-950/60 px-3 py-2 text-xs text-zinc-500">Skill details only. Final person verification is handled by admin.</div>
      )}
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
          <div className="mt-2 text-xs text-zinc-500">{profile.region} - {profile.availability.join(', ') || 'Availability not stated'}</div>
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
                  {role.specialRequirements ? <span className="ml-2 text-yellow-300">manual review</span> : null}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onAssign(profile, opportunity, role)} className="rounded bg-blue-600 px-2.5 py-1 text-xs hover:bg-blue-700">
                    {role.requiredSkills.every((skill) => profile.skills.includes(skill)) ? 'Accept to role' : 'Approve manually'}
                  </button>
                  <button onClick={() => onReject(profile, opportunity, role)} className="rounded bg-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-600">Not selected</button>
                </div>
              </div>
              <div className="text-xs text-zinc-500">
                {role.requiredSkills.every((skill) => profile.skills.includes(skill))
                  ? 'This volunteer meets the listed role skills.'
                  : 'This volunteer can still be accepted manually if operational needs justify it.'}
              </div>
            </div>
          ))}
          {!openRoles.length && <span className="text-xs text-zinc-500">All role slots are filled.</span>}
        </div>
      )}
    </div>
  );
}

function countPendingApplications(profile: VolunteerProfile, opportunityIds?: Set<number>) {
  const relevantApplications = opportunityIds
    ? profile.appliedOpportunityIds.filter((id) => opportunityIds.has(id))
    : profile.appliedOpportunityIds;

  return relevantApplications.filter((opportunityId) => {
    const resolved = profile.assignments.some((assignment) => assignment.opportunityId === opportunityId);
    return !resolved;
  }).length;
}
