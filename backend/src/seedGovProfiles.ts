import 'dotenv/config';
import { upsertPasswordUser } from './authRepository.js';

const profiles = [
  'MOH',
  'PUB',
  'LTA',
  'SCDF',
  'SPF',
  'NEA',
  'Enterprise SG',
  'Form Handler',
  'Admin',
];

for (const name of profiles) {
  const user = await upsertPasswordUser({
    username: name,
    password: name,
    displayName: name,
    tags: [name],
    role: name,
    agencyCode: name === 'Admin' || name === 'Form Handler' ? null : name,
  });

  console.log(`Seeded ${user?.username ?? name} / ${name}`);
}
