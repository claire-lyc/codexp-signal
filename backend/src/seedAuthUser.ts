import 'dotenv/config';
import { createPasswordUser } from './authRepository.js';

const email = process.env.DEMO_ADMIN_EMAIL ?? 'admin@signal.local';
const password = process.env.DEMO_ADMIN_PASSWORD;

if (!password) {
  throw new Error('Set DEMO_ADMIN_PASSWORD before running this seed.');
}

try {
  const user = await createPasswordUser({
    email,
    password,
    displayName: 'SiGnal Demo Admin',
    actorType: 'government_user',
    role: 'admin',
  });
  console.log(`Created demo admin ${user?.email ?? email}`);
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
    console.log(`Demo admin ${email} already exists.`);
  } else {
    throw error;
  }
}
