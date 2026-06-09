import 'dotenv/config';
import { pool } from './db.js';

const subjectAssignments = [
  { ticketId: 'TKT-0041', label: 'Medicine shortage', groupedWith: null },
  { ticketId: 'TKT-0040', label: 'Orchard Road flooding', groupedWith: null },
  { ticketId: 'TKT-0039', label: 'Medicine shortage', groupedWith: 'TKT-0041' },
  { ticketId: 'TKT-0038', label: 'Dengue symptoms', groupedWith: null },
  { ticketId: 'TKT-0036', label: 'Orchard Road flooding', groupedWith: 'TKT-0040' },
];

const clearAssignments = ['TKT-0037'];

const client = await pool.connect();

try {
  await client.query('BEGIN');

  for (const assignment of subjectAssignments) {
    const result = await client.query<{ id: string }>(
      `
        SELECT id
        FROM citizen.report_subject_tags
        WHERE label = $1
        LIMIT 1
      `,
      [assignment.label],
    );
    const subjectTagId = result.rows[0]?.id;
    if (!subjectTagId) {
      throw new Error(`Subject tag not found: ${assignment.label}. Run npm run db:schema:node first.`);
    }

    const groupedReportResult = assignment.groupedWith
      ? await client.query<{ id: string }>(
          `SELECT id FROM citizen.reports WHERE public_report_id = $1 LIMIT 1`,
          [assignment.groupedWith],
        )
      : null;
    const groupedReportId = groupedReportResult?.rows[0]?.id ?? null;

    await client.query(
      `
        UPDATE citizen.reports
        SET
          subject_tag_id = $2,
          grouped_report_id = $3,
          updated_at = now()
        WHERE public_report_id = $1
      `,
      [assignment.ticketId, subjectTagId, groupedReportId],
    );
  }

  await client.query(
    `
      UPDATE citizen.reports
      SET
        subject_tag_id = NULL,
        grouped_report_id = NULL,
        updated_at = now()
      WHERE public_report_id = ANY($1::text[])
    `,
    [clearAssignments],
  );

  await client.query('COMMIT');
  console.log('Backfilled demo ticket subject tags for TKT-0036 through TKT-0041.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
