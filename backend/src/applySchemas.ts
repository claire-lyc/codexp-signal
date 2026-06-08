import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const schemaFiles = [
  '000_init.sql',
  '001_auth.sql',
  '002_citizen_reports.sql',
  '003_dashboard_data.sql',
  '004_event_log.sql',
];

const dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaDir = path.resolve(dirname, '../database/schemas');

try {
  for (const file of schemaFiles) {
    const sql = await readFile(path.join(schemaDir, file), 'utf8');
    await pool.query(sql);
    console.log(`Applied ${file}`);
  }
} finally {
  await pool.end();
}
