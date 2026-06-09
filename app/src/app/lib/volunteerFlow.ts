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
  isSpecial?: boolean;
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

export const demoCitizenVolunteerProfile: VolunteerProfile = {
  id: 'VOL-DEMO',
  name: 'Alicia Tan',
  phone: '+65 8123 0000',
  email: 'alicia.tan@example.sg',
  region: 'Central',
  skills: ['Community Outreach', 'Translation', 'First Aid', 'IT Support'],
  availability: ['Weekends', 'Evenings', 'Emergency Only'],
  certifications: 'Standard First Aid, CPR + AED, bilingual community outreach experience.',
  emergencyContact: '+65 9000 0000',
  status: 'assigned',
  registeredAt: '2026-06-08T10:00:00+08:00',
  appliedOpportunityIds: [4, 7],
  assignments: [
    {
      id: 'ASN-DEMO-UPCOMING',
      opportunityId: 4,
      roleId: 'language-guide',
      roleTitle: 'Language support guide',
      status: 'accepted',
      assignedAt: '2026-06-09T09:20:00+08:00',
      note: 'Report to Bugis MRT Exit B command point.',
    },
  ],
};

export const volunteerOpportunities: VolunteerOpportunity[] = [
  {
    id: 1,
    title: 'Vaccination Centre Support',
    organization: 'Ministry of Health',
    location: 'Jurong West',
    region: 'West',
    urgency: 'high',
    volunteers: 0,
    needed: 25,
    requiredSkills: ['Healthcare', 'First Aid'],
    shift: 'Today, 14:00-18:00',
    reportingPoint: 'Jurong West ActiveSG Hall, Gate B',
    authorisedAgency: 'MOH',
    description: 'Assist with triage, queue support, and health screening at temporary care facilities.',
    roleSlots: [
      { id: 'triage', title: 'Triage assistant', needed: 10, assigned: 0, requiredSkills: ['Healthcare', 'First Aid'], specialRequirements: 'Basic PPE briefing required' },
      { id: 'queue', title: 'Queue marshal', needed: 15, assigned: 0, requiredSkills: ['Community Outreach'] },
    ],
  },
  {
    id: 2,
    title: 'Supply Distribution',
    organization: 'Enterprise Singapore',
    location: 'Tampines',
    region: 'East',
    urgency: 'medium',
    volunteers: 0,
    needed: 15,
    requiredSkills: ['Logistics', 'Driving'],
    shift: 'Tomorrow, 09:00-13:00',
    reportingPoint: 'Tampines West CC loading bay',
    authorisedAgency: 'Enterprise SG',
    description: 'Pack and distribute essential supplies to residents affected by medicine and food shortages.',
    roleSlots: [
      { id: 'driver', title: 'Van driver', needed: 5, assigned: 0, requiredSkills: ['Driving', 'Logistics'], specialRequirements: 'Class 3 licence' },
      { id: 'packer', title: 'Packing crew', needed: 10, assigned: 0, requiredSkills: ['Logistics', 'Heavy Lifting'] },
    ],
  },
  {
    id: 3,
    title: 'Community Welfare Checks',
    organization: "People's Association",
    location: 'Ang Mo Kio',
    region: 'Central',
    urgency: 'low',
    volunteers: 0,
    needed: 20,
    requiredSkills: ['Community Outreach', 'Translation', 'Social Work'],
    shift: 'Sat, 10:00-15:00',
    reportingPoint: 'Ang Mo Kio Town Council service desk',
    authorisedAgency: 'MSF',
    description: 'Visit elderly residents, check basic needs, and escalate urgent welfare issues.',
    roleSlots: [
      { id: 'welfare', title: 'Welfare caller', needed: 10, assigned: 0, requiredSkills: ['Community Outreach', 'Social Work'] },
      { id: 'translator', title: 'Language support', needed: 10, assigned: 0, requiredSkills: ['Translation', 'Language Support'] },
    ],
  },
  {
    id: 4,
    title: 'Transport Diversion Support',
    organization: 'Land Transport Authority',
    location: 'Bugis',
    region: 'Central',
    urgency: 'medium',
    volunteers: 0,
    needed: 12,
    requiredSkills: ['Community Outreach', 'Translation'],
    shift: 'Today, 16:00-20:00',
    reportingPoint: 'Bugis MRT Exit B command point',
    authorisedAgency: 'LTA',
    description: 'Guide commuters around temporary route diversions and support queue flow near affected stations.',
    roleSlots: [
      { id: 'crowd-guide', title: 'Crowd guide', needed: 8, assigned: 0, requiredSkills: ['Community Outreach'] },
      { id: 'language-guide', title: 'Language support guide', needed: 4, assigned: 0, requiredSkills: ['Translation', 'Language Support'], specialRequirements: 'Able to give directions in at least one additional language' },
    ],
  },
  {
    id: 5,
    title: 'Flood Relief Packing Line',
    organization: 'PUB',
    location: 'Potong Pasir',
    region: 'Central',
    urgency: 'high',
    volunteers: 0,
    needed: 18,
    requiredSkills: ['Logistics', 'Heavy Lifting'],
    shift: 'Tonight, 19:00-23:00',
    reportingPoint: 'Potong Pasir CC multipurpose hall',
    authorisedAgency: 'PUB',
    description: 'Prepare flood relief packs, sandbag bundles, and bottled water for low-lying residential blocks.',
    roleSlots: [
      { id: 'packer', title: 'Relief packer', needed: 12, assigned: 0, requiredSkills: ['Logistics'] },
      { id: 'loader', title: 'Loading crew', needed: 6, assigned: 0, requiredSkills: ['Heavy Lifting', 'Logistics'] },
    ],
  },
  {
    id: 6,
    title: 'Shelter Registration Desk',
    organization: 'SCDF',
    location: 'Tampines',
    region: 'East',
    urgency: 'high',
    volunteers: 0,
    needed: 14,
    requiredSkills: ['First Aid', 'Community Outreach'],
    shift: 'Tomorrow, 08:00-14:00',
    reportingPoint: 'Tampines East temporary shelter entrance',
    authorisedAgency: 'SCDF',
    description: 'Support evacuee registration, basic welfare checks, and escalation to shelter officers.',
    roleSlots: [
      { id: 'registration', title: 'Registration assistant', needed: 8, assigned: 0, requiredSkills: ['Community Outreach'] },
      { id: 'first-aid', title: 'First aid support', needed: 6, assigned: 0, requiredSkills: ['First Aid'], specialRequirements: 'Valid first aid or CPR certification preferred' },
    ],
  },
  {
    id: 7,
    title: 'Dengue Outreach Checks',
    organization: 'National Environment Agency',
    location: 'Bedok North',
    region: 'East',
    urgency: 'medium',
    volunteers: 0,
    needed: 16,
    requiredSkills: ['Community Outreach', 'Translation'],
    shift: 'Sat, 09:00-13:00',
    reportingPoint: 'Bedok North RC centre',
    authorisedAgency: 'NEA',
    description: 'Help residents understand dengue prevention steps and collect household outreach acknowledgements.',
    roleSlots: [
      { id: 'doorstep', title: 'Doorstep outreach', needed: 10, assigned: 0, requiredSkills: ['Community Outreach'] },
      { id: 'translator', title: 'Translation support', needed: 6, assigned: 0, requiredSkills: ['Translation', 'Language Support'] },
    ],
  },
  {
    id: 8,
    title: 'Neighbourhood Safety Patrol Support',
    organization: 'Singapore Police Force',
    location: 'Woodlands',
    region: 'North',
    urgency: 'low',
    volunteers: 0,
    needed: 10,
    requiredSkills: ['Community Outreach', 'IT Support'],
    shift: 'Fri, 18:00-22:00',
    reportingPoint: 'Woodlands NPC public assistance desk',
    authorisedAgency: 'SPF',
    description: 'Support public queue guidance, lost-person information collection, and non-sensitive wayfinding.',
    roleSlots: [
      { id: 'wayfinding', title: 'Public wayfinding', needed: 7, assigned: 0, requiredSkills: ['Community Outreach'] },
      { id: 'digital-entry', title: 'Digital form assistant', needed: 3, assigned: 0, requiredSkills: ['IT Support'] },
    ],
  },
  {
    id: 9,
    title: 'SME Supply Hotline Support',
    organization: 'Enterprise Singapore',
    location: 'One-North',
    region: 'West',
    urgency: 'medium',
    volunteers: 0,
    needed: 10,
    requiredSkills: ['IT Support', 'Logistics', 'Translation'],
    shift: 'Tomorrow, 10:00-16:00',
    reportingPoint: 'One-North business continuity support desk',
    authorisedAgency: 'Enterprise SG',
    description: 'Help triage SME supply requests and translate basic hotline information for affected businesses.',
    roleSlots: [
      { id: 'hotline', title: 'Hotline triage assistant', needed: 6, assigned: 0, requiredSkills: ['IT Support', 'Community Outreach'] },
      { id: 'supply-logistics', title: 'Supply request classifier', needed: 4, assigned: 0, requiredSkills: ['Logistics'] },
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
  {
    id: 'VOL-1004',
    name: 'Nur Aisyah',
    phone: '+65 8333 7812',
    email: 'aisyah@example.sg',
    region: 'Central',
    skills: ['Community Outreach', 'Translation', 'Language Support'],
    availability: ['Weekends', 'Evenings'],
    certifications: 'Malay and English outreach volunteer, PA grassroots events',
    emergencyContact: '+65 9000 1004',
    status: 'verified',
    registeredAt: '2026-06-07T18:15:00+08:00',
    appliedOpportunityIds: [4, 7],
    assignments: [],
  },
  {
    id: 'VOL-1005',
    name: 'Koh Ming Xuan',
    phone: '+65 8222 3344',
    email: 'mingxuan@example.sg',
    region: 'North',
    skills: ['IT Support', 'Community Outreach'],
    availability: ['Weekdays', 'Evenings'],
    certifications: 'Helpdesk volunteer, digital form support',
    emergencyContact: '+65 9000 1005',
    status: 'pending_review',
    registeredAt: '2026-06-08T11:45:00+08:00',
    appliedOpportunityIds: [8],
    assignments: [],
  },
  {
    id: 'VOL-1006',
    name: 'Siti Rahimah',
    phone: '+65 8555 9088',
    email: 'siti@example.sg',
    region: 'East',
    skills: ['First Aid', 'Community Outreach', 'Social Work'],
    availability: ['Weekends', 'Emergency Only'],
    certifications: 'CPR + AED, shelter welfare volunteer',
    emergencyContact: '+65 9000 1006',
    status: 'verified',
    registeredAt: '2026-06-07T12:30:00+08:00',
    appliedOpportunityIds: [6],
    assignments: [],
  },
  {
    id: 'VOL-1007',
    name: 'Ravi Menon',
    phone: '+65 8111 7788',
    email: 'ravi@example.sg',
    region: 'Central',
    skills: ['Logistics', 'Heavy Lifting', 'Driving'],
    availability: ['Emergency Only'],
    certifications: 'Class 3 licence, warehouse operations',
    emergencyContact: '+65 9000 1007',
    status: 'verified',
    registeredAt: '2026-06-06T20:10:00+08:00',
    appliedOpportunityIds: [5],
    assignments: [],
  },
  {
    id: 'VOL-1008',
    name: 'Lim Jia En',
    phone: '+65 8999 6612',
    email: 'jiaen@example.sg',
    region: 'East',
    skills: ['Healthcare', 'First Aid', 'Community Outreach'],
    availability: ['Weekdays'],
    certifications: 'Clinic assistant, basic PPE training',
    emergencyContact: '+65 9000 1008',
    status: 'pending_review',
    registeredAt: '2026-06-09T08:05:00+08:00',
    appliedOpportunityIds: [1, 6],
    assignments: [],
  },
  {
    id: 'VOL-1009',
    name: 'Chen Yu Ting',
    phone: '+65 8777 3030',
    email: 'yuting@example.sg',
    region: 'West',
    skills: ['IT Support', 'Translation', 'Language Support'],
    availability: ['Weekends', 'Evenings'],
    certifications: 'Mandarin-English translation, call centre support',
    emergencyContact: '+65 9000 1009',
    status: 'verified',
    registeredAt: '2026-06-08T14:35:00+08:00',
    appliedOpportunityIds: [9],
    assignments: [],
  },
  {
    id: 'VOL-1010',
    name: 'Farhan Ismail',
    phone: '+65 8666 5544',
    email: 'farhan@example.sg',
    region: 'Central',
    skills: ['Community Outreach', 'Heavy Lifting', 'Logistics'],
    availability: ['Weekends', 'Emergency Only'],
    certifications: 'Relief packing volunteer, crowd guidance',
    emergencyContact: '+65 9000 1010',
    status: 'pending_review',
    registeredAt: '2026-06-09T09:15:00+08:00',
    appliedOpportunityIds: [5, 4],
    assignments: [],
  },
  {
    id: 'VOL-1011',
    name: 'Grace Ho',
    phone: '+65 8444 2901',
    email: 'grace@example.sg',
    region: 'Central',
    skills: ['Social Work', 'Community Outreach', 'Translation'],
    availability: ['Weekdays', 'Weekends'],
    certifications: 'Social service volunteer, elderly outreach',
    emergencyContact: '+65 9000 1011',
    status: 'verified',
    registeredAt: '2026-06-06T16:55:00+08:00',
    appliedOpportunityIds: [3],
    assignments: [],
  },
  {
    id: 'VOL-1012',
    name: 'Rachel Ng',
    phone: '+65 8129 4410',
    email: 'rachel.ng@example.sg',
    region: 'Central',
    skills: ['Community Outreach', 'Translation'],
    availability: ['Weekdays', 'Evenings'],
    certifications: 'Community event marshal, bilingual commuter assistance.',
    emergencyContact: '+65 9000 1012',
    status: 'assigned',
    registeredAt: '2026-06-06T11:20:00+08:00',
    appliedOpportunityIds: [4],
    assignments: [{
      id: 'ASN-SEED-1012-LTA',
      opportunityId: 4,
      roleId: 'crowd-guide',
      roleTitle: 'Crowd guide',
      status: 'accepted',
      assignedAt: '2026-06-09T08:35:00+08:00',
      note: 'Report to Bugis MRT Exit B command point.',
    }],
  },
  {
    id: 'VOL-1013',
    name: 'Omar Lim',
    phone: '+65 8188 2034',
    email: 'omar.lim@example.sg',
    region: 'Central',
    skills: ['Community Outreach', 'IT Support'],
    availability: ['Evenings', 'Emergency Only'],
    certifications: 'Transit crowd-control volunteer and digital queue support.',
    emergencyContact: '+65 9000 1013',
    status: 'assigned',
    registeredAt: '2026-06-06T13:05:00+08:00',
    appliedOpportunityIds: [4],
    assignments: [{
      id: 'ASN-SEED-1013-LTA',
      opportunityId: 4,
      roleId: 'crowd-guide',
      roleTitle: 'Crowd guide',
      status: 'accepted',
      assignedAt: '2026-06-09T08:42:00+08:00',
      note: 'Report to Bugis MRT Exit B command point.',
    }],
  },
  {
    id: 'VOL-1014',
    name: 'Mei Ling Chua',
    phone: '+65 8332 1904',
    email: 'meiling.chua@example.sg',
    region: 'West',
    skills: ['Healthcare', 'First Aid'],
    availability: ['Weekdays', 'Emergency Only'],
    certifications: 'CPR + AED, clinic registration support.',
    emergencyContact: '+65 9000 1014',
    status: 'assigned',
    registeredAt: '2026-06-05T17:30:00+08:00',
    appliedOpportunityIds: [1],
    assignments: [{
      id: 'ASN-SEED-1014-MOH',
      opportunityId: 1,
      roleId: 'triage',
      roleTitle: 'Triage assistant',
      status: 'accepted',
      assignedAt: '2026-06-09T07:50:00+08:00',
      note: 'Report to Jurong West ActiveSG Hall, Gate B.',
    }],
  },
  {
    id: 'VOL-1015',
    name: 'Hafiz Rahman',
    phone: '+65 8661 7720',
    email: 'hafiz.rahman@example.sg',
    region: 'West',
    skills: ['Community Outreach', 'First Aid'],
    availability: ['Weekdays', 'Evenings'],
    certifications: 'Queue marshal for temporary clinic operations.',
    emergencyContact: '+65 9000 1015',
    status: 'assigned',
    registeredAt: '2026-06-05T18:10:00+08:00',
    appliedOpportunityIds: [1],
    assignments: [{
      id: 'ASN-SEED-1015-MOH',
      opportunityId: 1,
      roleId: 'queue',
      roleTitle: 'Queue marshal',
      status: 'accepted',
      assignedAt: '2026-06-09T07:55:00+08:00',
      note: 'Report to Jurong West ActiveSG Hall, Gate B.',
    }],
  },
  {
    id: 'VOL-1016',
    name: 'Victor Seah',
    phone: '+65 8771 0098',
    email: 'victor.seah@example.sg',
    region: 'East',
    skills: ['Driving', 'Logistics'],
    availability: ['Weekends', 'Emergency Only'],
    certifications: 'Class 3 driving licence, delivery route coordination.',
    emergencyContact: '+65 9000 1016',
    status: 'assigned',
    registeredAt: '2026-06-06T09:15:00+08:00',
    appliedOpportunityIds: [2],
    assignments: [{
      id: 'ASN-SEED-1016-ESG',
      opportunityId: 2,
      roleId: 'driver',
      roleTitle: 'Van driver',
      status: 'accepted',
      assignedAt: '2026-06-09T08:05:00+08:00',
      note: 'Report to Tampines West CC loading bay.',
    }],
  },
  {
    id: 'VOL-1017',
    name: 'Nadia Koh',
    phone: '+65 8490 2211',
    email: 'nadia.koh@example.sg',
    region: 'Central',
    skills: ['Logistics', 'Heavy Lifting'],
    availability: ['Evenings', 'Emergency Only'],
    certifications: 'Relief pack assembly and warehouse inventory.',
    emergencyContact: '+65 9000 1017',
    status: 'assigned',
    registeredAt: '2026-06-06T19:25:00+08:00',
    appliedOpportunityIds: [5],
    assignments: [{
      id: 'ASN-SEED-1017-PUB',
      opportunityId: 5,
      roleId: 'packer',
      roleTitle: 'Relief packer',
      status: 'accepted',
      assignedAt: '2026-06-09T09:05:00+08:00',
      note: 'Report to Potong Pasir CC multipurpose hall.',
    }],
  },
  {
    id: 'VOL-1018',
    name: 'Daryl Foo',
    phone: '+65 8782 6610',
    email: 'daryl.foo@example.sg',
    region: 'East',
    skills: ['First Aid', 'Community Outreach'],
    availability: ['Weekends', 'Emergency Only'],
    certifications: 'Standard First Aid, shelter intake support.',
    emergencyContact: '+65 9000 1018',
    status: 'assigned',
    registeredAt: '2026-06-06T10:50:00+08:00',
    appliedOpportunityIds: [6],
    assignments: [{
      id: 'ASN-SEED-1018-SCDF',
      opportunityId: 6,
      roleId: 'registration',
      roleTitle: 'Registration assistant',
      status: 'accepted',
      assignedAt: '2026-06-09T09:10:00+08:00',
      note: 'Report to Tampines East temporary shelter entrance.',
    }],
  },
  {
    id: 'VOL-1019',
    name: 'Serene Teo',
    phone: '+65 8339 0127',
    email: 'serene.teo@example.sg',
    region: 'East',
    skills: ['Community Outreach', 'Translation'],
    availability: ['Weekends', 'Evenings'],
    certifications: 'Doorstep outreach volunteer, Mandarin-English translation.',
    emergencyContact: '+65 9000 1019',
    status: 'assigned',
    registeredAt: '2026-06-06T12:45:00+08:00',
    appliedOpportunityIds: [7],
    assignments: [{
      id: 'ASN-SEED-1019-NEA',
      opportunityId: 7,
      roleId: 'doorstep',
      roleTitle: 'Doorstep outreach',
      status: 'accepted',
      assignedAt: '2026-06-09T09:15:00+08:00',
      note: 'Report to Bedok North RC centre.',
    }],
  },
  {
    id: 'VOL-1020',
    name: 'Marcus Low',
    phone: '+65 8778 6642',
    email: 'marcus.low@example.sg',
    region: 'North',
    skills: ['Community Outreach', 'IT Support'],
    availability: ['Evenings'],
    certifications: 'Digital form support and public assistance desk volunteer.',
    emergencyContact: '+65 9000 1020',
    status: 'assigned',
    registeredAt: '2026-06-06T14:15:00+08:00',
    appliedOpportunityIds: [8],
    assignments: [{
      id: 'ASN-SEED-1020-SPF',
      opportunityId: 8,
      roleId: 'wayfinding',
      roleTitle: 'Public wayfinding',
      status: 'accepted',
      assignedAt: '2026-06-09T09:20:00+08:00',
      note: 'Report to Woodlands NPC public assistance desk.',
    }],
  },
  {
    id: 'VOL-1021',
    name: 'Irene Goh',
    phone: '+65 8120 8803',
    email: 'irene.goh@example.sg',
    region: 'Central',
    skills: ['Social Work', 'Community Outreach'],
    availability: ['Weekdays', 'Weekends'],
    certifications: 'Elderly welfare check volunteer, social service intake.',
    emergencyContact: '+65 9000 1021',
    status: 'assigned',
    registeredAt: '2026-06-05T16:20:00+08:00',
    appliedOpportunityIds: [3],
    assignments: [{
      id: 'ASN-SEED-1021-MSF',
      opportunityId: 3,
      roleId: 'welfare',
      roleTitle: 'Welfare caller',
      status: 'accepted',
      assignedAt: '2026-06-09T09:25:00+08:00',
      note: 'Report to Ang Mo Kio Town Council service desk.',
    }],
  },
  {
    id: 'VOL-1022',
    name: 'Benjamin Yeo',
    phone: '+65 8667 3310',
    email: 'benjamin.yeo@example.sg',
    region: 'West',
    skills: ['IT Support', 'Community Outreach', 'Translation'],
    availability: ['Weekdays', 'Evenings'],
    certifications: 'Hotline support, ticket triage, Mandarin-English translation.',
    emergencyContact: '+65 9000 1022',
    status: 'assigned',
    registeredAt: '2026-06-05T15:35:00+08:00',
    appliedOpportunityIds: [9],
    assignments: [{
      id: 'ASN-SEED-1022-ESG',
      opportunityId: 9,
      roleId: 'hotline',
      roleTitle: 'Hotline triage assistant',
      status: 'accepted',
      assignedAt: '2026-06-09T09:30:00+08:00',
      note: 'Report to One-North business continuity support desk.',
    }],
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
