import 'dotenv/config';
import { upsertCitizenPasswordUser } from './authRepository.js';

const user = await upsertCitizenPasswordUser({
  username: 'user',
  password: 'user',
  displayName: 'Demo Citizen',
  tags: ['Citizen'],
});

console.log(`Seeded citizen ${user?.username ?? 'user'} / user`);
