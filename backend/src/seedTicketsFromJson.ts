import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

type SeedTicket = {
  id: string;
  timestamp: string;
  reporter: string;
  message: string;
  location: string;
  crisisType: string;
  reportType: string;
  subjectTag?: string | null;
  status: 'open' | 'in-progress' | 'resolved' | 'grouped';
  assignedAgency: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  hasImage: boolean;
  relatedTickets: string[];
  comments: Array<{
    author: string;
    visibility: 'public' | 'internal';
    body: string;
    createdAt: string;
  }>;
  pingedAgencies: string[];
};

type SeedData = {
  tickets: SeedTicket[];
};

const dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(dirname, '../data/ticket-seed.json');
const data = JSON.parse(await readFile(dataPath, 'utf8')) as SeedData;

const client = await pool.connect();

try {
  await client.query('BEGIN');

  await client.query('DELETE FROM citizen.reports');

  const reportIds = new Map<string, string>();

  for (const ticket of data.tickets) {
    const agencyId = await upsertAgency(ticket.assignedAgency);
    const subjectTagId = ticket.subjectTag ? await getSubjectTagId(ticket.subjectTag) : null;
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO citizen.reports (
          public_report_id,
          reporter_label,
          crisis_type,
          report_type,
          description,
          location_text,
          severity,
          status,
          assigned_agency_id,
          subject_tag_id,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
        RETURNING id
      `,
      [
        ticket.id,
        ticket.reporter,
        toDbCrisisType(ticket.crisisType),
        ticket.reportType,
        ticket.message,
        ticket.location,
        ticket.urgency,
        toDbStatus(ticket.status),
        agencyId,
        subjectTagId,
        ticket.timestamp,
      ],
    );
    reportIds.set(ticket.id, result.rows[0].id);
  }

  for (const ticket of data.tickets) {
    const reportId = reportIds.get(ticket.id);
    if (!reportId) continue;

    const groupedId = ticket.relatedTickets.map((id) => reportIds.get(id)).find(Boolean);
    if (groupedId) {
      await client.query(`UPDATE citizen.reports SET grouped_report_id = $2 WHERE id = $1`, [reportId, groupedId]);
    }

    if (ticket.hasImage) {
      await client.query(
        `
          INSERT INTO citizen.report_images (
            report_id,
            original_filename,
            mime_type,
            byte_size,
            storage_bucket,
            storage_key,
            processing_status,
            created_at
          )
          VALUES ($1, $2, 'image/jpeg', 0, 'seed', $3, 'processed', $4)
        `,
        [reportId, `${ticket.id}.jpg`, `seed/${ticket.id}.jpg`, ticket.timestamp],
      );
    }

    for (const comment of ticket.comments) {
      await client.query(
        `
          INSERT INTO citizen.report_comments (report_id, author_user_id, author_type, visibility, body, created_at)
          VALUES ($1, NULL, 'government_user', $2, $3, $4)
        `,
        [reportId, comment.visibility, comment.body, comment.createdAt],
      );
    }

    for (const agencyCode of ticket.pingedAgencies) {
      const agencyId = await upsertAgency(agencyCode);
      await client.query(
        `
          INSERT INTO citizen.report_agency_pings (report_id, agency_id, pinged_by_user_id, created_at)
          VALUES ($1, $2, NULL, $3)
        `,
        [reportId, agencyId, ticket.timestamp],
      );
    }
  }

  const highestTicketNumber = Math.max(
    ...data.tickets.map((ticket) => Number(ticket.id.replace(/^TKT-/, ''))).filter(Number.isFinite),
    0,
  );
  await client.query(`SELECT setval('citizen.report_ticket_seq', $1, true)`, [highestTicketNumber]);

  await client.query('COMMIT');
  console.log(`Seeded ${data.tickets.length} demo tickets from backend/data/ticket-seed.json.`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}

async function upsertAgency(code: string) {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO auth.government_agencies (code, name)
      VALUES ($1, $1)
      ON CONFLICT (code)
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `,
    [code],
  );
  return result.rows[0].id;
}

async function getSubjectTagId(label: string) {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM citizen.report_subject_tags WHERE label = $1 LIMIT 1`,
    [label],
  );
  return result.rows[0]?.id ?? null;
}

function toDbStatus(status: SeedTicket['status']) {
  if (status === 'in-progress') return 'in_progress';
  if (status === 'grouped') return 'grouped';
  if (status === 'resolved') return 'resolved';
  return 'submitted';
}

function toDbCrisisType(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('health')) return 'health';
  if (normalized.includes('weather')) return 'weather';
  if (normalized.includes('supply')) return 'supply_chain';
  if (normalized.includes('infrastructure')) return 'infrastructure';
  if (normalized.includes('cyber')) return 'cybersecurity';
  return 'general';
}
