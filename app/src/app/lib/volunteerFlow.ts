export type VolunteerUrgency = 'high' | 'medium' | 'low';
export type VolunteerStatus = 'draft' | 'pending_review' | 'verified' | 'assigned' | 'checked_in' | 'completed';
export type AssignmentStatus = 'offered' | 'accepted' | 'checked_in' | 'completed' | 'declined';
export type VolunteerNotificationStatus = 'sent' | 'read';

export type VolunteerOpportunity = {
  id: number;
  title: string;
  organization: string;
  location: string;
  region: string;
  urgency: VolunteerUrgency;
  volunteers: number;
  needed: number;
  requiredSkills: string[];
  shift: string;
  reportingPoint: string;
  authorisedAgency: string;
  description: string;
  roleSlots: VolunteerRoleSlot[];
};

export type VolunteerAssignment = {
  id: string;
  opportunityId: number;
  roleId?: string;
  roleTitle?: string;
  status: AssignmentStatus;
  assignedAt: string;
  note: string;
};

export type VolunteerNotification = {
  id: string;
  volunteerId: string;
  opportunityId: number;
  roleId?: string;
  roleTitle?: string;
  agency: string;
  message: string;
  status: VolunteerNotificationStatus;
  createdAt: string;
};

export type VolunteerRoleSlot = {
  id: string;
  title: string;
  needed: number;
  assigned: number;
  requiredSkills: string[];
  specialRequirements?: string;
};

export type VolunteerProfile = {
  id: string;
  name: string;
  phone: string;
  email: string;
  region: string;
  skills: string[];
  availability: string[];
  certifications: string;
  emergencyContact: string;
  status: VolunteerStatus;
  registeredAt: string;
  appliedOpportunityIds: number[];
  assignments: VolunteerAssignment[];
};

export const volunteerStorageKey = 'signal.volunteer.profile.v1';
export const volunteerNeedsStorageKey = 'signal.volunteer.needs.v1';
export const volunteerNotificationsStorageKey = 'signal.volunteer.notifications.v1';

export const volunteerSkills = [
  'Healthcare',
  'First Aid',
  'Logistics',
  'Driving',
  'IT Support',
  'Community Outreach',
  'Translation',
  'Heavy Lifting',
  'Social Work',
  'Language Support',
];

export const volunteerAvailability = ['Weekdays', 'Weekends', 'Evenings', 'Emergency Only'];

export const volunteerOpportunities: VolunteerOpportunity[] = [
  {
    id: 1,
    title: 'Vaccination Centre Support',
    organization: 'Ministry of Health',
    location: 'Jurong West',
    region: 'West',
    urgency: 'high',
    volunteers: 12,
    needed: 25,
    requiredSkills: ['Healthcare', 'First Aid'],
    shift: 'Today, 14:00-18:00',
    reportingPoint: 'Jurong West ActiveSG Hall, Gate B',
    authorisedAgency: 'MOH',
    description: 'Assist with triage, queue support, and health screening at temporary care facilities.',
    roleSlots: [
      { id: 'triage', title: 'Triage assistant', needed: 10, assigned: 5, requiredSkills: ['Healthcare', 'First Aid'], specialRequirements: 'Basic PPE briefing required' },
      { id: 'queue', title: 'Queue marshal', needed: 15, assigned: 7, requiredSkills: ['Community Outreach'] },
    ],
  },
  {
    id: 2,
    title: 'Supply Distribution',
    organization: 'Enterprise Singapore',
    location: 'Tampines',
    region: 'East',
    urgency: 'medium',
    volunteers: 8,
    needed: 15,
    requiredSkills: ['Logistics', 'Driving'],
    shift: 'Tomorrow, 09:00-13:00',
    reportingPoint: 'Tampines West CC loading bay',
    authorisedAgency: 'Enterprise SG',
    description: 'Pack and distribute essential supplies to residents affected by medicine and food shortages.',
    roleSlots: [
      { id: 'driver', title: 'Van driver', needed: 5, assigned: 3, requiredSkills: ['Driving', 'Logistics'], specialRequirements: 'Class 3 licence' },
      { id: 'packer', title: 'Packing crew', needed: 10, assigned: 5, requiredSkills: ['Logistics', 'Heavy Lifting'] },
    ],
  },
  {
    id: 3,
    title: 'Community Welfare Checks',
    organization: "People's Association",
    location: 'Ang Mo Kio',
    region: 'Central',
    urgency: 'low',
    volunteers: 20,
    needed: 20,
    requiredSkills: ['Community Outreach', 'Translation', 'Social Work'],
    shift: 'Sat, 10:00-15:00',
    reportingPoint: 'Ang Mo Kio Town Council service desk',
    authorisedAgency: 'MSF',
    description: 'Visit elderly residents, check basic needs, and escalate urgent welfare issues.',
    roleSlots: [
      { id: 'welfare', title: 'Welfare caller', needed: 10, assigned: 10, requiredSkills: ['Community Outreach', 'Social Work'] },
      { id: 'translator', title: 'Language support', needed: 10, assigned: 10, requiredSkills: ['Translation', 'Language Support'] },
    ],
  },
];

export const demoVolunteerProfiles: VolunteerProfile[] = [
  {
    id: 'VOL-1001',
    name: 'Tan Wei Lin',
    phone: '+65 8123 4567',
    email: 'weilin@example.sg',
    region: 'West',
    skills: ['Healthcare', 'First Aid'],
    availability: ['Weekdays', 'Emergency Only'],
    certifications: 'First Aid, nursing assistant',
    emergencyContact: '+65 9000 1001',
    status: 'verified',
    registeredAt: '2026-06-08T08:10:00+08:00',
    appliedOpportunityIds: [1],
    assignments: [],
  },
  {
    id: 'VOL-1002',
    name: 'Priya S.',
    phone: '+65 8456 2222',
    email: 'priya@example.sg',
    region: 'West',
    skills: ['Healthcare', 'Translation'],
    availability: ['Evenings'],
    certifications: 'CPR + AED',
    emergencyContact: '+65 9000 1002',
    status: 'pending_review',
    registeredAt: '2026-06-08T09:25:00+08:00',
    appliedOpportunityIds: [1],
    assignments: [],
  },
  {
    id: 'VOL-1003',
    name: 'Lee Jun Hao',
    phone: '+65 8765 1111',
    email: 'junhao@example.sg',
    region: 'East',
    skills: ['Logistics', 'Driving', 'Heavy Lifting'],
    availability: ['Weekends', 'Emergency Only'],
    certifications: 'Class 3 driving licence',
    emergencyContact: '+65 9000 1003',
    status: 'verified',
    registeredAt: '2026-06-07T15:40:00+08:00',
    appliedOpportunityIds: [2],
    assignments: [],
  },
];

export function readVolunteerProfile(): VolunteerProfile | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(volunteerStorageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VolunteerProfile;
  } catch {
    window.localStorage.removeItem(volunteerStorageKey);
    return null;
  }
}

export function saveVolunteerProfile(profile: VolunteerProfile) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(volunteerStorageKey, JSON.stringify(profile));
  window.dispatchEvent(new Event('signal-volunteer-updated'));
}

export function clearVolunteerProfile() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(volunteerStorageKey);
  window.dispatchEvent(new Event('signal-volunteer-updated'));
}

export function readVolunteerOpportunities(): VolunteerOpportunity[] {
  if (typeof window === 'undefined') return volunteerOpportunities;
  const raw = window.localStorage.getItem(volunteerNeedsStorageKey);
  if (!raw) return volunteerOpportunities;
  try {
    const custom = JSON.parse(raw) as VolunteerOpportunity[];
    return [...custom, ...volunteerOpportunities];
  } catch {
    window.localStorage.removeItem(volunteerNeedsStorageKey);
    return volunteerOpportunities;
  }
}

export function saveCustomVolunteerOpportunities(opportunities: VolunteerOpportunity[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(volunteerNeedsStorageKey, JSON.stringify(opportunities));
  window.dispatchEvent(new Event('signal-volunteer-needs-updated'));
}

export function readVolunteerNotifications(): VolunteerNotification[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(volunteerNotificationsStorageKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as VolunteerNotification[];
  } catch {
    window.localStorage.removeItem(volunteerNotificationsStorageKey);
    return [];
  }
}

export function saveVolunteerNotifications(notifications: VolunteerNotification[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(volunteerNotificationsStorageKey, JSON.stringify(notifications));
  window.dispatchEvent(new Event('signal-volunteer-notifications-updated'));
}

export function makeVolunteerId() {
  return `VOL-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function scoreVolunteerForOpportunity(profile: Pick<VolunteerProfile, 'skills' | 'region' | 'availability'>, opportunity: VolunteerOpportunity) {
  const breakdown = scoreVolunteerBreakdown(profile, opportunity);
  return breakdown.total;
}

export function scoreVolunteerBreakdown(profile: Pick<VolunteerProfile, 'skills' | 'region' | 'availability'>, opportunity: VolunteerOpportunity) {
  const skillHits = opportunity.requiredSkills.filter((skill) => profile.skills.includes(skill)).length;
  const roleSkillHits = opportunity.roleSlots.reduce((hits, role) => hits + role.requiredSkills.filter((skill) => profile.skills.includes(skill)).length, 0);
  const roleSkillTotal = opportunity.roleSlots.reduce((total, role) => total + role.requiredSkills.length, 0);
  const skillScore = Math.max(
    skillHits / Math.max(1, opportunity.requiredSkills.length),
    roleSkillHits / Math.max(1, roleSkillTotal),
  );
  const skills = Math.round(skillScore * 50);
  const region = profile.region === opportunity.region || profile.region === 'Any Region' ? 30 : 0;
  const availability = profile.availability.includes('Emergency Only') || profile.availability.includes('Weekends') ? 20 : profile.availability.length ? 10 : 0;
  return {
    skills,
    region,
    availability,
    total: Math.min(99, skills + region + availability),
  };
}

export function opportunityCapacity(opportunity: VolunteerOpportunity, profile?: VolunteerProfile | null) {
  const hasAccepted = profile?.assignments.some((assignment) => assignment.opportunityId === opportunity.id && assignment.status !== 'declined') ?? false;
  return opportunity.volunteers + (hasAccepted ? 1 : 0);
}

export function roleCapacity(role: VolunteerRoleSlot, profile?: VolunteerProfile | null, opportunityId?: number) {
  const hasAccepted = profile?.assignments.some((assignment) => assignment.opportunityId === opportunityId && assignment.roleId === role.id && assignment.status !== 'declined') ?? false;
  return role.assigned + (hasAccepted ? 1 : 0);
}

export function statusLabel(status: VolunteerStatus) {
  if (status === 'pending_review') return 'Pending review';
  if (status === 'checked_in') return 'Checked in';
  return status.charAt(0).toUpperCase() + status.slice(1);
}
