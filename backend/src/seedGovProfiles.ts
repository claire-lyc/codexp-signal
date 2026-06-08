import 'dotenv/config';
import { upsertPasswordUser } from './authRepository.js';

const profiles = [
  { username: 'Amirah Tan', password: 'Amirah Tan', displayName: 'Amirah Tan', role: 'Health Operations Officer', agencyCode: 'MOH', tags: ['MOH', 'Health Operations Officer'] },
  { username: 'Daniel Koh', password: 'Daniel Koh', displayName: 'Daniel Koh', role: 'Flood Response Officer', agencyCode: 'PUB', tags: ['PUB', 'Flood Response Officer'] },
  { username: 'Jolene Lim', password: 'Jolene Lim', displayName: 'Jolene Lim', role: 'Transport Network Analyst', agencyCode: 'LTA', tags: ['LTA', 'Transport Network Analyst'] },
  { username: 'Marcus Yeo', password: 'Marcus Yeo', displayName: 'Marcus Yeo', role: 'Emergency Operations Officer', agencyCode: 'SCDF', tags: ['SCDF', 'Emergency Operations Officer'] },
  { username: 'Nur Aisyah', password: 'Nur Aisyah', displayName: 'Nur Aisyah', role: 'Community Safety Officer', agencyCode: 'SPF', tags: ['SPF', 'Community Safety Officer'] },
  { username: 'Rachel Ong', password: 'Rachel Ong', displayName: 'Rachel Ong', role: 'Environmental Risk Analyst', agencyCode: 'NEA', tags: ['NEA', 'Environmental Risk Analyst'] },
  { username: 'Sean Lee', password: 'Sean Lee', displayName: 'Sean Lee', role: 'Supply Resilience Lead', agencyCode: 'Enterprise SG', tags: ['Enterprise SG', 'Supply Resilience Lead'] },
  { username: 'Form Handler', password: 'Form Handler', displayName: 'Form Handler', role: 'Form Handler', agencyCode: null, tags: ['Form Handler'] },
  { username: 'Admin', password: 'Admin', displayName: 'Admin', role: 'Admin', agencyCode: null, tags: ['Admin'] },
  { username: 'MOH', password: 'MOH', displayName: 'MOH', role: 'MOH', agencyCode: 'MOH', tags: ['MOH'] },
  { username: 'PUB', password: 'PUB', displayName: 'PUB', role: 'PUB', agencyCode: 'PUB', tags: ['PUB'] },
];

for (const profile of profiles) {
  const user = await upsertPasswordUser({
    username: profile.username,
    password: profile.password,
    displayName: profile.displayName,
    tags: profile.tags,
    role: profile.role,
    agencyCode: profile.agencyCode,
  });

  console.log(`Seeded ${user?.username ?? profile.username} / ${profile.password}`);
}
