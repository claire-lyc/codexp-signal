import 'dotenv/config';
import { pool } from './db.js';
import { refreshExternalDashboardSnapshot } from './externalDashboardRefresh.js';

try {
  await refreshExternalDashboardSnapshot();
} finally {
  await pool.end();
}