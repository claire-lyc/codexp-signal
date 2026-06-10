// Future endpoints:
// GET /api/volunteers/opportunities
// GET /api/volunteers/applications
// PATCH /api/volunteers/applications/{id}/verify
// POST /api/volunteers/assignments
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Building2, ChevronDown, Clock, Lock, MapPin, Plus, RotateCcw, ShieldCheck, UserCheck, Users, X } from 'lucide-react';
import { API_REFRESH_INTERVAL_MS, apiUrl } from '../../lib/api';
import { authHeaders } from '../../lib/auth';
import {
  demoVolunteerProfiles,
  opportunityCapacity,
  readVolunteerOpportunities,
  readVolunteerProfile,
  saveCustomVolunteerOpportunities,
  clearStaleVolunteerNeeds,
  saveVolunteerProfile,
  scoreVolunteerBreakdown,
  scoreVolunteerForOpportunity,
  statusLabel,
  volunteerNeedsStorageKey,
  volunteerSkills,
  type UrgentVolunteerAlert,
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
  roles: NeedRoleForm[];
};

type NeedRoleForm = {
  id: string;
  title: string;
  needed: number;
  skills: string[];
  isSpecial: boolean;
  specialRequirements: string;
};

type UrgentAlertForm = {
  title: string;
  message: string;
  location: string;
  targetAddress: string;
  region: string;
  radiusKm: number;
  needed: number;
};

type CreateMode = 'need' | 'urgent';

const agencies = ['All agencies', 'LTA', 'MOH', 'PUB', 'SCDF', 'SPF', 'NEA', 'Enterprise SG', 'MSF'];

const emptyNeedForm: NeedForm = {
  title: 'Islandwide Flood Recovery Support',
  location: 'Islandwide / West staging points',
  region: 'Islandwide',
  urgency: 'medium',
  shift: 'Tomorrow, 09:00-17:00',
  reportingPoint: 'Jurong West Community Club volunteer desk',
  description: 'Volunteers are needed for non-urgent flood recovery support after the Boon Lay / Jurong West flooding. Tasks include first-aid support, multilingual assistance, logistics coordination, welfare pack sorting, shelter support, and post-flood cleanup once areas are declared safe.',
  roles: [
    {
      id: 'draft-role-1',
      title: 'First-aid and welfare support',
      needed: 6,
      skills: ['First Aid', 'Community Outreach'],
      isSpecial: true,
      specialRequirements: 'Basic first-aid certification preferred.',
    },
    {
      id: 'draft-role-2',
      title: 'Multilingual resident support',
      needed: 8,
      skills: ['Translation', 'Community Outreach'],
      isSpecial: false,
      specialRequirements: '',
    },
    {
      id: 'draft-role-3',
      title: 'Logistics and cleanup crew',
      needed: 12,
      skills: ['Logistics', 'Heavy Lifting'],
      isSpecial: false,
      specialRequirements: '',
    },
  ],
};

const emptyUrgentAlertForm: UrgentAlertForm = {
  title: 'Urgent Support Needed - Boon Lay Flood Response',
  message: 'PUB is requesting nearby registered volunteers around Boon Lay and Jurong West for immediate low-risk support. Tasks include distributing bottled water, guiding residents away from flooded paths, queue control near shelters, and helping direct residents to safe waiting areas. Do not enter floodwater or perform rescue tasks.',
  location: 'Boon Lay / Jurong West',
  targetAddress: 'Boon Lay Way, Singapore 609966',
  region: 'West',
  radiusKm: 3,
  needed: 10,
};

const demoNeedTitles = new Set([emptyNeedForm.title]);
const demoUrgentAlertTitles = new Set([emptyUrgentAlertForm.title]);

const urgentAlertRadiusOptions = [1, 3, 5, 8, 10];

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

function estimateUrgentAlertReach(applicantCount: number, radiusKm: number) {
  const factor = radiusKm <= 1 ? 0.2 : radiusKm <= 3 ? 0.4 : radiusKm <= 5 ? 0.6 : radiusKm <= 8 ? 0.8 : 1;
  return Math.max(1, Math.round(applicantCount * factor));
}

function bestRoleForProfile(profile: VolunteerProfile, opportunity: VolunteerOpportunity) {
  return opportunity.roleSlots.find((role) => role.assigned < role.needed && role.requiredSkills.some((skill) => profile.skills.includes(skill)))
    ?? opportunity.roleSlots.find((role) => role.assigned < role.needed)
    ?? opportunity.roleSlots[0];
}

function roleMatchesAllSkills(profile: VolunteerProfile, role: VolunteerRoleSlot) {
  return role.requiredSkills.every((skill) => profile.skills.includes(skill));
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

function volunteerIdentity(profile: VolunteerProfile | RemoteVolunteerProfile) {
  return 'userId' in profile ? `${profile.userId}:${profile.id}` : profile.id;
}

export default function GovVolunteers() {
  const [currentAgency, setCurrentAgency] = useState(() => agencyFromStoredUser());
  const [citizenProfile, setCitizenProfile] = useState<VolunteerProfile | null>(null);
  const [remoteProfiles, setRemoteProfiles] = useState<RemoteVolunteerProfile[]>([]);
  const [demoProfiles, setDemoProfiles] = useState<VolunteerProfile[]>(demoVolunteerProfiles);
  const [customNeeds, setCustomNeeds] = useState<VolunteerOpportunity[]>(() => readCustomNeeds());
  const [urgentAlerts, setUrgentAlerts] = useState<UrgentVolunteerAlert[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(1);
  const [showNeedForm, setShowNeedForm] = useState(false);
  const [needForm, setNeedForm] = useState<NeedForm>(emptyNeedForm);
  const [showUrgentAlertForm, setShowUrgentAlertForm] = useState(false);
  const [urgentAlertForm, setUrgentAlertForm] = useState<UrgentAlertForm>(emptyUrgentAlertForm);
  const [createMode, setCreateMode] = useState<CreateMode>('need');
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [allocateModal, setAllocateModal] = useState<VolunteerOpportunity | null>(null);
  const [additionalSlots, setAdditionalSlots] = useState(5);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [pageMode, setPageMode] = useState<'assignment' | 'profiles'>('assignment');
  const [boardTab, setBoardTab] = useState<'open' | 'full'>('open');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleView, setRoleView] = useState<'pending' | 'accepted'>('pending');

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

  const loadUrgentAlerts = () =>
    fetch(apiUrl('/api/gov/volunteers/urgent-alerts'), { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) throw new Error('Urgent alerts unavailable');
        return response.json() as Promise<{ items: UrgentVolunteerAlert[] }>;
      })
      .then((data) => {
        setUrgentAlerts(data.items);
      })
      .catch(() => {
        setUrgentAlerts([]);
      });

  useEffect(() => {
    loadCitizenProfile();
    loadRemoteProfiles();
    loadUrgentAlerts();
    const refreshNeeds = () => setCustomNeeds(readCustomNeeds());
    const timer = window.setInterval(() => {
      loadRemoteProfiles();
      loadUrgentAlerts();
    }, API_REFRESH_INTERVAL_MS);
    window.addEventListener('storage', loadCitizenProfile);
    window.addEventListener('storage', refreshNeeds);
    window.addEventListener('signal-volunteer-updated', loadCitizenProfile);
    window.addEventListener('signal-volunteer-needs-updated', refreshNeeds);
    return () => {
      window.clearInterval(timer);
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
      const key = volunteerIdentity(profile);
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

  const manualApprovalCount = useMemo(() => agencyOpportunities.reduce((count, opportunity) => (
    count + rawApplicants
      .filter((profile) => profile.appliedOpportunityIds.includes(opportunity.id))
      .filter((profile) => !profile.assignments.some((assignment) => assignment.opportunityId === opportunity.id))
      .filter((profile) => !opportunity.roleSlots.some((role) => roleMatchesAllSkills(profile, role)))
      .length
  ), 0), [agencyOpportunities, rawApplicants]);

  const skillVerificationProfiles = useMemo(() => (
    rawApplicants
      .filter((profile) => profile.status === 'pending_review')
      .filter((profile) => currentAgency === 'All agencies' || agencyOpportunities.some((opportunity) => hasSkillOverlap(profile, opportunity)))
      .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))
  ), [agencyOpportunities, currentAgency, rawApplicants]);

  const openOpportunities = opportunities.filter((opportunity) => opportunity.filled < opportunity.needed);
  const fullOpportunities = opportunities.filter((opportunity) => opportunity.filled >= opportunity.needed);
  const visibleOpportunities = boardTab === 'open' ? openOpportunities : fullOpportunities;
  const selectedOpportunity = visibleOpportunities.find((opportunity) => opportunity.id === expandedId) ?? visibleOpportunities[0] ?? null;
  const selectedRole = selectedOpportunity?.roleSlots.find((role) => role.id === selectedRoleId) ?? selectedOpportunity?.roleSlots[0] ?? null;
  const visibleOpportunityIds = new Set(agencyOpportunities.map((opportunity) => opportunity.id));

  const waitingList = applicants.filter((profile) => countPendingApplications(profile, visibleOpportunityIds) > 0);
  const readyPool = applicants.filter((profile) => profile.status === 'verified' && countPendingApplications(profile, visibleOpportunityIds) === 0);
  const deployed = applicants.filter((profile) => profile.status === 'assigned' || profile.status === 'checked_in');

  const stats = {
    ready: readyPool.length,
    waiting: waitingList.length,
    deployed: deployed.length,
  };

  const agencyStats = {
    needs: agencyOpportunities.length,
    applications: manualApprovalCount,
    accepted: rawApplicants.reduce((count, profile) => (
      count + profile.assignments.filter((assignment) => {
        const opportunity = agencyOpportunities.find((item) => item.id === assignment.opportunityId);
        return opportunity && (assignment.status === 'accepted' || assignment.status === 'checked_in' || assignment.status === 'completed');
      }).length
    ), 0),
    pendingSkills: skillVerificationProfiles.length,
  };
  const nearbyReachEstimate = estimateUrgentAlertReach(
    rawApplicants.length,
    urgentAlertForm.radiusKm,
  );

  const verifyVolunteer = (profile: VolunteerProfile) => {
    updateProfile(profile, { status: 'verified' });
    pushActivity(`${profile.name} verified`);
  };

  const makeAssignment = (opportunity: VolunteerOpportunity, role: VolunteerRoleSlot, status: VolunteerAssignment['status'] = 'accepted'): VolunteerAssignment => ({
    id: `ASN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    opportunityId: opportunity.id,
    roleId: role.id,
    roleTitle: role.title,
    status,
    assignedAt: new Date().toISOString(),
    note: role.specialRequirements ? `${role.specialRequirements}. Report to ${opportunity.reportingPoint}` : `Report to ${opportunity.reportingPoint}`,
  });

  const assignVolunteer = (
    profile: VolunteerProfile,
    opportunity: VolunteerOpportunity,
    role: VolunteerRoleSlot,
    status: VolunteerAssignment['status'] = 'accepted',
  ) => {
    if (!canAllocate(opportunity)) {
      pushActivity(`${currentAgency} cannot assign ${opportunity.title}`);
      return;
    }

    const assignment = makeAssignment(opportunity, role, status);

    updateProfile(profile, {
      status: 'assigned',
      appliedOpportunityIds: Array.from(new Set([...profile.appliedOpportunityIds, opportunity.id])),
      assignments: [...profile.assignments.filter((item) => item.opportunityId !== opportunity.id), assignment],
    });
    pushActivity(`${profile.name} assigned to ${role.title}`);
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

  const updateNeedRole = (roleId: string, patch: Partial<NeedRoleForm>) => {
    setNeedForm((current) => ({
      ...current,
      roles: current.roles.map((role) => role.id === roleId ? { ...role, ...patch } : role),
    }));
  };

  const addNeedRole = () => {
    setNeedForm((current) => ({
      ...current,
      roles: [
        ...current.roles,
        {
          id: `draft-role-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title: '',
          needed: 1,
          skills: [],
          isSpecial: false,
          specialRequirements: '',
        },
      ],
    }));
  };

  const removeNeedRole = (roleId: string) => {
    setNeedForm((current) => ({
      ...current,
      roles: current.roles.length <= 1 ? current.roles : current.roles.filter((role) => role.id !== roleId),
    }));
  };

  const addNeed = () => {
    const agency = currentAgency === 'All agencies' ? 'PUB' : currentAgency;
    const createdAt = Date.now();
    const roleSlots: VolunteerRoleSlot[] = needForm.roles.map((role, index) => ({
      id: `role-${createdAt}-${index}`,
      title: role.title.trim() || `Volunteer role ${index + 1}`,
      needed: Math.max(1, role.needed || 1),
      assigned: 0,
      requiredSkills: role.skills.length ? role.skills : ['Community Outreach'],
      isSpecial: role.isSpecial,
      specialRequirements: role.isSpecial ? role.specialRequirements.trim() || undefined : undefined,
    }));

    const needed = roleSlots.reduce((total, role) => total + role.needed, 0);
    const newNeed: VolunteerOpportunity = {
      id: Date.now(),
      title: needForm.title.trim() || 'New Volunteer Need',
      organization: agency,
      location: needForm.location.trim() || 'Singapore',
      region: needForm.region,
      urgency: needForm.urgency,
      volunteers: 0,
      needed,
      requiredSkills: Array.from(new Set(roleSlots.flatMap((role) => role.requiredSkills))),
      shift: needForm.shift.trim() || 'Today',
      reportingPoint: needForm.reportingPoint.trim() || 'Agency command point',
      authorisedAgency: agency,
      description: needForm.description.trim() || 'Agency-created volunteer need.',
      roleSlots,
    };

    const nextCustomNeeds = [newNeed, ...customNeeds];
    setCustomNeeds(nextCustomNeeds);
    saveCustomVolunteerOpportunities(nextCustomNeeds);
    setExpandedId(newNeed.id);
    setBoardTab('open');
    setShowNeedForm(false);
    pushActivity(`${agency} added ${newNeed.title}`);
  };

  const resetDemoVolunteerFlow = async () => {
    const nextCustomNeeds = customNeeds.filter((need) => (
      !demoNeedTitles.has(need.title) &&
      !(need.title.toLowerCase().includes('flood') && need.location.toLowerCase().includes('west'))
    ));
    const demoUrgentAlerts = urgentAlerts.filter((alert) => (
      demoUrgentAlertTitles.has(alert.title) ||
      (alert.title.toLowerCase().includes('boon lay') && alert.location.toLowerCase().includes('jurong west'))
    ));

    setCustomNeeds(nextCustomNeeds);
    saveCustomVolunteerOpportunities(nextCustomNeeds);
    window.dispatchEvent(new Event('signal-volunteer-needs-updated'));

    await Promise.all(demoUrgentAlerts.map((alert) => (
      fetch(apiUrl(`/api/gov/volunteers/urgent-alerts/${alert.id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      }).catch(() => null)
    )));
    setUrgentAlerts((current) => current.filter((alert) => !demoUrgentAlerts.some((demo) => demo.id === alert.id)));
    setNeedForm(emptyNeedForm);
    setUrgentAlertForm(emptyUrgentAlertForm);
    setExpandedId(nextCustomNeeds[0]?.id ?? null);
    pushActivity('Demo volunteer submissions cleared');
  };

  const sendUrgentAlert = () => {
    const agency = currentAgency === 'All agencies' ? 'Government' : currentAgency;
    fetch(apiUrl('/api/gov/volunteers/urgent-alerts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        ...urgentAlertForm,
        agency,
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to send urgent alert');
        return response.json() as Promise<{ item: UrgentVolunteerAlert }>;
      })
      .then((data) => {
        setUrgentAlerts((current) => [data.item, ...current]);
        setUrgentAlertForm(emptyUrgentAlertForm);
        setShowUrgentAlertForm(false);
        pushActivity(`${agency} alerted nearby volunteers for ${data.item.location}`);
      })
      .catch(() => {
        pushActivity('Urgent nearby alert failed to send');
      });
  };

  const closeCreatePanel = () => {
    setShowNeedForm(false);
    setShowUrgentAlertForm(false);
    setCreateMenuOpen(false);
  };

  const openCreatePanel = (mode: CreateMode = 'need') => {
    if ((mode === 'need' && showNeedForm) || (mode === 'urgent' && showUrgentAlertForm)) {
      closeCreatePanel();
      return;
    }
    setCreateMode(mode);
    setCreateMenuOpen(false);
    if (mode === 'urgent') {
      setShowUrgentAlertForm(true);
      setShowNeedForm(false);
      return;
    }
    setShowNeedForm(true);
    setShowUrgentAlertForm(false);
  };

  const handleAllocate = (opportunity: VolunteerOpportunity) => {
    pushActivity(`${additionalSlots} standby slots opened for ${opportunity.title}`);
    setAllocateModal(null);
  };

  const canAllocate = (opportunity: VolunteerOpportunity) => currentAgency === 'All agencies' || currentAgency === opportunity.authorisedAgency;

  useEffect(() => {
    const autoAcceptCandidate = agencyOpportunities.flatMap((opportunity) => (
      rawApplicants
        .filter((profile) => profile.appliedOpportunityIds.includes(opportunity.id))
        .filter((profile) => !profile.assignments.some((assignment) => assignment.opportunityId === opportunity.id))
        .map((profile) => {
          const matchingRole = opportunity.roleSlots.find((role) => {
            if (!roleMatchesAllSkills(profile, role)) return false;
            return filledSlotsForRole(rawApplicants, opportunity.id, role) < role.needed;
          });
          return matchingRole ? { profile, opportunity, role: matchingRole } : null;
        })
        .filter(Boolean)
    ))[0];

    if (autoAcceptCandidate) {
      assignVolunteer(
        autoAcceptCandidate.profile,
        autoAcceptCandidate.opportunity,
        autoAcceptCandidate.role,
        'accepted',
      );
    }
  }, [agencyOpportunities, rawApplicants]);

  useEffect(() => {
    if (!selectedOpportunity) {
      if (selectedRoleId !== null) setSelectedRoleId(null);
      return;
    }
    if (!selectedRole || !selectedOpportunity.roleSlots.some((role) => role.id === selectedRole.id)) {
      setSelectedRoleId(selectedOpportunity.roleSlots[0]?.id ?? null);
    }
  }, [selectedOpportunity, selectedRole, selectedRoleId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Volunteers & Resources</h1>
          <p className="text-zinc-400">Review volunteer profiles, create needs, alert nearby volunteers, and assign approved roles.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative inline-flex">
            <button onClick={() => openCreatePanel('need')} className="inline-flex items-center gap-2 rounded-l-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              New
            </button>
            <button
              type="button"
              onClick={() => setCreateMenuOpen((open) => !open)}
              className="rounded-r-lg border-l border-blue-500/60 bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-700"
              aria-label="Choose new request type"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            {createMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-52 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl">
                <button
                  type="button"
                  onClick={() => openCreatePanel('need')}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-900"
                >
                  <span>Volunteer need</span>
                  <Plus className="h-4 w-4 text-zinc-500" />
                </button>
                <button
                  type="button"
                  onClick={() => openCreatePanel('urgent')}
                  className="flex w-full items-center justify-between border-t border-zinc-800 px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-900"
                >
                  <span>Urgent request</span>
                  <AlertCircle className="h-4 w-4 text-red-400" />
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={resetDemoVolunteerFlow}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Demo
          </button>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
            <label className="mb-1 block text-xs text-zinc-500">Agency filter</label>
            <select value={currentAgency} onChange={(event) => setCurrentAgency(event.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100">
              {agencies.map((agency) => <option key={agency}>{agency}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Metric icon={<MapPin className="h-5 w-5 text-blue-500" />} label="Open Needs" value={agencyStats.needs} badge="Events" />
        <Metric icon={<Users className="h-5 w-5 text-orange-500" />} label="Manual Approvals" value={agencyStats.applications} badge="Review" />
        <Metric icon={<AlertCircle className="h-5 w-5 text-yellow-500" />} label="Pending Verification" value={agencyStats.pendingSkills} badge="Review" />
        <Metric icon={<ShieldCheck className="h-5 w-5 text-green-500" />} label="Assigned" value={agencyStats.accepted} badge="Active" />
        <Metric icon={<UserCheck className="h-5 w-5 text-purple-500" />} label="Deployed" value={stats.deployed} badge="Live" />
      </div>

      {showUrgentAlertForm && (
        <section className="rounded-xl border border-red-900/70 bg-red-950/10 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-red-100">Urgent Nearby Volunteer Alert</h2>
              <p className="text-sm text-red-200/70">This sends a rapid nearby-response request to registered volunteers in the selected region. They can accept in one tap.</p>
            </div>
            <button onClick={closeCreatePanel} className="rounded-lg bg-zinc-900 p-2 text-zinc-300 hover:bg-zinc-800">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-5">
            <Field label="Alert title" value={urgentAlertForm.title} onChange={(value) => setUrgentAlertForm((current) => ({ ...current, title: value }))} />

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
              <div className="mb-1 text-base font-semibold text-white">Target location</div>
              <div className="mb-4 text-sm text-zinc-500">Set the address and how far out to notify nearby volunteers.</div>

              <div className="grid gap-4">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-violet-600/15 p-3 text-violet-300">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Location Name</div>
                        <input
                          value={urgentAlertForm.location}
                          onChange={(event) => setUrgentAlertForm((current) => ({ ...current, location: event.target.value }))}
                          placeholder="Bugis Community Support Point"
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Address</div>
                        <input
                          value={urgentAlertForm.targetAddress}
                          onChange={(event) => setUrgentAlertForm((current) => ({ ...current, targetAddress: event.target.value }))}
                          placeholder="230 Victoria Street, Singapore 188024"
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 text-sm font-medium">Radius</div>
                    <input
                      type="range"
                      min={0}
                      max={urgentAlertRadiusOptions.length - 1}
                      step={1}
                      value={urgentAlertRadiusOptions.indexOf(urgentAlertForm.radiusKm)}
                      onChange={(event) => {
                        const nextRadius = urgentAlertRadiusOptions[Number(event.target.value)] ?? 5;
                        setUrgentAlertForm((current) => ({ ...current, radiusKm: nextRadius }));
                      }}
                      className="h-2 w-full cursor-pointer accent-violet-500"
                    />
                  </div>
                  <div className="mt-6 shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
                    {urgentAlertForm.radiusKm} km
                  </div>
                </div>
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>1 km</span>
                  <span>5 km</span>
                  <span>10 km</span>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-300">
                  Sending within <span className="font-medium text-white">{urgentAlertForm.radiusKm} km</span> of <span className="font-medium text-white">{urgentAlertForm.location}</span>. Estimated reach: <span className="font-medium text-white">{nearbyReachEstimate}</span> volunteers.
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
              <label className="block">
                <div className="mb-2 text-sm font-medium">Volunteers needed</div>
                <input type="number" min={1} value={urgentAlertForm.needed} onChange={(event) => setUrgentAlertForm((current) => ({ ...current, needed: Math.max(1, Number(event.target.value) || 1) }))} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600" />
              </label>
              <label className="block">
                <div className="mb-2 text-sm font-medium">Alert message</div>
                <textarea value={urgentAlertForm.message} onChange={(event) => setUrgentAlertForm((current) => ({ ...current, message: event.target.value }))} rows={3} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600" />
              </label>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={sendUrgentAlert} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
              Send urgent alert
            </button>
          </div>
        </section>
      )}

      <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
        <button onClick={() => setPageMode('assignment')} className={`rounded-md px-3 py-1.5 text-sm ${pageMode === 'assignment' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>Opportunity Assignment</button>
        <button onClick={() => setPageMode('profiles')} className={`rounded-md px-3 py-1.5 text-sm ${pageMode === 'profiles' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Volunteer Profiles & Certs</button>
      </div>

      {urgentAlerts.length > 0 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Nearby Volunteer Alerts</h2>
              <p className="text-sm text-zinc-500">Live urgent-call responses from registered volunteers.</p>
            </div>
            <span className="rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">{urgentAlerts.filter((alert) => alert.status === 'active').length} active</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {urgentAlerts.slice(0, 4).map((alert) => (
              <div key={alert.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{alert.title}</div>
                    <div className="mt-1 text-sm text-zinc-400">{alert.location} • {alert.targetAddress}</div>
                  </div>
                  <span className={`rounded px-2 py-1 text-xs ${alert.status === 'active' ? 'bg-red-950 text-red-300' : 'bg-zinc-800 text-zinc-300'}`}>{alert.status}</span>
                </div>
                <div className="mt-2 text-sm text-zinc-300">{alert.message}</div>
                <div className="mt-3 text-xs text-zinc-500">{alert.acceptedCount}/{alert.needed} accepted • {alert.radiusKm} km radius • {alert.agency}</div>
                {alert.responders.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {alert.responders.slice(0, 3).map((responder) => (
                      <div key={`${alert.id}-${responder.volunteerId}`} className="rounded bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
                        <span className="font-medium">{responder.name}</span> • {responder.phone} • {responder.region}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {showNeedForm && (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 p-5">
          <div>
            <h2 className="font-semibold">Add Agency Volunteer Need</h2>
            <p className="text-sm text-zinc-500">Use roles when one operation needs different volunteer types.</p>
          </div>
          <button onClick={closeCreatePanel} className="rounded-lg bg-zinc-800 p-2 hover:bg-zinc-700">
            {showNeedForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <Field label="Need title" value={needForm.title} onChange={(value) => setNeedForm({ ...needForm, title: value })} />
            <Field label="Location" value={needForm.location} onChange={(value) => setNeedForm({ ...needForm, location: value })} />
            <SelectField label="Region" value={needForm.region} values={['Islandwide', 'Central', 'North', 'South', 'East', 'West']} onChange={(value) => setNeedForm({ ...needForm, region: value })} />
            <SelectField label="Urgency" value={needForm.urgency} values={['high', 'medium', 'low']} onChange={(value) => setNeedForm({ ...needForm, urgency: value as NeedForm['urgency'] })} />
            <Field label="Shift" value={needForm.shift} onChange={(value) => setNeedForm({ ...needForm, shift: value })} />
            <Field label="Reporting point" value={needForm.reportingPoint} onChange={(value) => setNeedForm({ ...needForm, reportingPoint: value })} />
            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-medium">Description</label>
              <textarea value={needForm.description} onChange={(event) => setNeedForm({ ...needForm, description: event.target.value })} rows={3} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
            </div>
            <div className="lg:col-span-2 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Roles</div>
                  <div className="text-xs text-zinc-500">Add the roles this agency needs. Mark only specialised roles when extra checks or requirements apply.</div>
                </div>
                <button type="button" onClick={addNeedRole} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700">
                  <Plus className="h-4 w-4" />
                  Add role
                </button>
              </div>
              {needForm.roles.map((role, index) => (
                <RoleBuilder
                  key={role.id}
                  title={`Role ${index + 1}`}
                  role={role}
                  canRemove={needForm.roles.length > 1}
                  onRole={(patch) => updateNeedRole(role.id, patch)}
                  onRemove={() => removeNeedRole(role.id)}
                />
              ))}
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
      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Opportunity Assignment Board</h2>
              <p className="text-xs text-zinc-500">{currentAgency === 'All agencies' ? 'Showing all agencies.' : `Showing ${currentAgency} needs only.`} Select an event to review its open roles and volunteer matches.</p>
            </div>
            <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
              <button onClick={() => setBoardTab('open')} className={`rounded-md px-3 py-1.5 text-sm ${boardTab === 'open' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>Open ({openOpportunities.length})</button>
              <button onClick={() => setBoardTab('full')} className={`rounded-md px-3 py-1.5 text-sm ${boardTab === 'full' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Full ({fullOpportunities.length})</button>
            </div>
          </div>

          {visibleOpportunities.map((opportunity) => (
            <div
              key={opportunity.id}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${expandedId === opportunity.id ? `${urgencyColors[opportunity.urgency]} border-blue-500 ring-1 ring-blue-500/40` : urgencyColors[opportunity.urgency]}`}
            >
              <button className="w-full text-left" onClick={() => { setExpandedId(opportunity.id); setSelectedRoleId(opportunity.roleSlots[0]?.id ?? null); }}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-semibold">{opportunity.title}</span>
                <span className={`rounded px-2 py-0.5 text-xs ${urgencyBadge[opportunity.urgency]}`}>{opportunity.urgency.toUpperCase()}</span>
              </div>
              <div className="space-y-1 text-sm text-zinc-400">
                <div className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{opportunity.location}</div>
                <div>{opportunity.shift}</div>
                <div>{opportunity.candidates.filter((candidate) => candidate.applied && !candidate.assigned).length} pending applicants</div>
                <div>{opportunity.filled}/{opportunity.needed} assigned</div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-zinc-800">
                <div className={`h-1.5 rounded-full ${opportunity.filled >= opportunity.needed ? 'bg-green-500' : opportunity.urgency === 'high' ? 'bg-red-500' : 'bg-yellow-500'}`} style={{ width: `${Math.min(100, (opportunity.filled / opportunity.needed) * 100)}%` }} />
              </div>
              </button>
              <div className="mt-4 space-y-2 border-t border-zinc-800/70 pt-3">
                {opportunity.roleSlots.map((role) => {
                  const filled = filledSlotsForRole(rawApplicants, opportunity.id, role);
                  const isSelected = expandedId === opportunity.id && selectedRoleId === role.id;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => { setExpandedId(opportunity.id); setSelectedRoleId(role.id); }}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${isSelected ? 'border-blue-500 bg-zinc-900 text-white' : 'border-zinc-800 bg-zinc-950/50 text-zinc-300 hover:border-zinc-700'}`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">{role.title}</span>
                        {role.isSpecial && <span className="rounded bg-yellow-950 px-1.5 py-0.5 text-[10px] text-yellow-300">Special</span>}
                      </span>
                      <span className="text-xs text-zinc-500">{filled}/{role.needed}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {!visibleOpportunities.length && <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">No {boardTab === 'open' ? 'open' : 'fully staffed'} opportunities.</div>}
        </div>

        <aside className="space-y-4">
          {selectedOpportunity ? (
            <>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedOpportunity.title}</h2>
                    <p className="mt-1 text-sm text-zinc-500">{selectedOpportunity.authorisedAgency} - {selectedOpportunity.location} - {selectedOpportunity.shift}</p>
                  </div>
                  {!canAllocate(selectedOpportunity) && <span className="inline-flex items-center gap-1 text-xs text-zinc-500"><Lock className="h-3 w-3" />Auth: {selectedOpportunity.authorisedAgency}</span>}
                </div>
                <p className="mb-4 text-sm text-zinc-300">{selectedOpportunity.description}</p>
                {canAllocate(selectedOpportunity) && (
                  <button onClick={() => { setAllocateModal(selectedOpportunity); setAdditionalSlots(Math.max(1, selectedOpportunity.needed - selectedOpportunity.filled)); }} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm transition-colors hover:bg-blue-700">
                    <Plus className="h-4 w-4" />
                    Open Slots
                  </button>
                )}
              </div>
              {selectedRole ? (
                <RoleAssignmentPanel
                  key={selectedRole.id}
                  role={selectedRole}
                  opportunity={selectedOpportunity}
                  candidates={selectedOpportunity.candidates}
                  profiles={rawApplicants}
                  canAssign={canAllocate(selectedOpportunity)}
                  roleView={roleView}
                  setRoleView={setRoleView}
                  onVerify={verifyVolunteer}
                  onAssign={assignVolunteer}
                  onReject={rejectVolunteer}
                />
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">Select an event on the left to review its roles and volunteer stack.</div>
          )}
        </aside>
      </section>
      ) : (
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <ActionSection
            title="Volunteer Verification"
            description="Review volunteer skills, certification notes, contact details, and profile readiness in one place."
            emptyMessage="No volunteer profiles are awaiting approval."
          >
            {skillVerificationProfiles.map((profile) => (
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
  clearStaleVolunteerNeeds();
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
            Assign Role
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
  onRole,
  onRemove,
  canRemove,
}: {
  title: string;
  role: NeedRoleForm;
  onRole: (patch: Partial<NeedRoleForm>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const toggleSkill = (skill: string) => {
    onRole({ skills: role.skills.includes(skill) ? role.skills.filter((item) => item !== skill) : [...role.skills, skill] });
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="font-medium">{title}</div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={role.isSpecial}
              onChange={(event) => onRole({ isSpecial: event.target.checked })}
              className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-800"
            />
            Special role
          </label>
          {canRemove && (
            <button type="button" onClick={onRemove} className="rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">
              Remove
            </button>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
        <Field label="Role title" value={role.title} onChange={(value) => onRole({ title: value })} />
        <label className="block">
          <div className="mb-2 text-sm font-medium">Needed</div>
          <input type="number" min={1} value={role.needed} onChange={(event) => onRole({ needed: Number(event.target.value) })} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {volunteerSkills.map((skill) => (
          <button key={skill} type="button" onClick={() => toggleSkill(skill)} className={`rounded-full border px-2.5 py-1 text-xs ${role.skills.includes(skill) ? 'border-blue-500 bg-blue-600/20 text-blue-200' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600'}`}>
            {skill}
          </button>
        ))}
      </div>
      {role.isSpecial && (
        <label className="mt-3 block">
          <div className="mb-2 text-sm font-medium">Special requirements</div>
          <input
            value={role.specialRequirements}
            onChange={(event) => onRole({ specialRequirements: event.target.value })}
            placeholder="Example: Class 3 licence, valid first aid cert, language requirement"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </label>
      )}
    </div>
  );
}

function CandidateRow({
  candidate,
  role,
  opportunity,
  roleHasCapacity,
  canAssign,
  onVerify,
  onAssign,
  onReject,
}: {
  candidate: { profile: VolunteerProfile; match: number; breakdown: { skills: number; region: number; availability: number; total: number }; applied: boolean; assigned?: VolunteerAssignment };
  role: VolunteerRoleSlot;
  opportunity: VolunteerOpportunity;
  roleHasCapacity: boolean;
  canAssign: boolean;
  onVerify: (profile: VolunteerProfile) => void;
  onAssign: (profile: VolunteerProfile, opportunity: VolunteerOpportunity, role: VolunteerRoleSlot, status?: VolunteerAssignment['status']) => void;
  onReject: (profile: VolunteerProfile, opportunity: VolunteerOpportunity, role: VolunteerRoleSlot) => void;
}) {
  const { profile } = candidate;

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
          {!canAssign && <span className="inline-flex items-center gap-1 text-xs text-zinc-600"><Lock className="h-3 w-3" />No permission</span>}
        </div>
      </div>
      {canAssign && !candidate.assigned && (
        <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
          <div className="rounded-lg bg-zinc-950/50 p-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-300">{role.title}</span>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => onAssign(profile, opportunity, role, 'accepted')} disabled={!roleHasCapacity} className="rounded bg-blue-600 px-2.5 py-1 text-xs hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                  Assign volunteer
                </button>
                <button onClick={() => onReject(profile, opportunity, role)} className="rounded bg-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-600">Not selected</button>
              </div>
            </div>
            <div className="text-xs text-zinc-500">
              {roleMatchesAllSkills(profile, role)
                ? 'This volunteer meets the listed role skills and can be assigned directly if slots remain.'
                : 'This volunteer applied for this role but does not meet every listed skill, so assigning here is a manual override.'}
            </div>
          </div>
          {!roleHasCapacity && <span className="text-xs text-zinc-500">All role slots are filled.</span>}
        </div>
      )}
    </div>
  );
}

function RoleAssignmentPanel({
  role,
  opportunity,
  candidates,
  profiles,
  canAssign,
  roleView,
  setRoleView,
  onVerify,
  onAssign,
  onReject,
}: {
  role: VolunteerRoleSlot;
  opportunity: VolunteerOpportunity;
  candidates: Array<{
    profile: VolunteerProfile;
    match: number;
    breakdown: { skills: number; region: number; availability: number; total: number };
    applied: boolean;
    assigned?: VolunteerAssignment;
  }>;
  profiles: VolunteerProfile[];
  canAssign: boolean;
  roleView: 'pending' | 'accepted';
  setRoleView: (view: 'pending' | 'accepted') => void;
  onVerify: (profile: VolunteerProfile) => void;
  onAssign: (profile: VolunteerProfile, opportunity: VolunteerOpportunity, role: VolunteerRoleSlot, status?: VolunteerAssignment['status']) => void;
  onReject: (profile: VolunteerProfile, opportunity: VolunteerOpportunity, role: VolunteerRoleSlot) => void;
}) {
  const filledSlots = filledSlotsForRole(profiles, opportunity.id, role);
  const roleHasCapacity = filledSlots < role.needed;
  const relevantCandidates = candidates.filter((candidate) => (
    candidate.assigned?.roleId === role.id ||
    candidate.applied ||
    role.requiredSkills.some((skill) => candidate.profile.skills.includes(skill))
  ));
  const acceptedCandidates = relevantCandidates.filter((candidate) => (
    candidate.assigned?.roleId === role.id &&
    (candidate.assigned.status === 'accepted' || candidate.assigned.status === 'checked_in' || candidate.assigned.status === 'completed')
  ));
  const pendingCandidates = relevantCandidates.filter((candidate) => !candidate.assigned);
  const visibleCandidates = roleView === 'accepted' ? acceptedCandidates : pendingCandidates;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{role.title}</h3>
            {role.isSpecial && <span className="rounded bg-yellow-950 px-2 py-0.5 text-xs text-yellow-300">Special role</span>}
          </div>
          <div className="mt-1 text-xs text-zinc-500">{filledSlots}/{role.needed} filled · {relevantCandidates.length} visible volunteers</div>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-right text-xs text-zinc-400">
          <div>{Math.max(0, role.needed - filledSlots)} open slots</div>
          <div className="text-zinc-600">{opportunity.authorisedAgency}</div>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {role.requiredSkills.map((skill) => <span key={skill} className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">{skill}</span>)}
      </div>
      {role.specialRequirements && <div className="mb-4 text-xs text-yellow-300">Special: {role.specialRequirements}</div>}
      <div className="mb-4 inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
        <button onClick={() => setRoleView('pending')} className={`rounded-md px-3 py-1.5 text-sm ${roleView === 'pending' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}>Yet to Accept ({pendingCandidates.length})</button>
        <button onClick={() => setRoleView('accepted')} className={`rounded-md px-3 py-1.5 text-sm ${roleView === 'accepted' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Accepted ({acceptedCandidates.length})</button>
      </div>
      <div className="space-y-2">
        {roleView === 'accepted'
          ? acceptedCandidates.map((candidate) => (
              <AcceptedVolunteerRow
                key={`${opportunity.id}-${role.id}-${candidate.profile.id}`}
                profile={candidate.profile}
                assignment={candidate.assigned!}
              />
            ))
          : pendingCandidates.map((candidate) => (
              <CandidateRow
                key={`${opportunity.id}-${role.id}-${candidate.profile.id}`}
                candidate={candidate}
                role={role}
                opportunity={opportunity}
                roleHasCapacity={roleHasCapacity}
                canAssign={canAssign}
                onVerify={onVerify}
                onAssign={onAssign}
                onReject={onReject}
              />
            ))}
        {!visibleCandidates.length && <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-500">No volunteers in this filter for the selected role.</div>}
      </div>
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
