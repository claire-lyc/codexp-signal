import 'dotenv/config';
import type { PoolClient } from 'pg';
import { pool } from './db.js';

type DemoTicket = {
  marker: string;
  reportType: string;
  title: string | null;
  description: string;
  location: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'submitted' | 'in_progress' | 'resolved' | 'rejected';
  agency: { code: string; name: string };
  subject?: { label: string; categories: string[]; description: string };
  minutesAgo: number;
  pings?: Array<{ code: string; name: string }>;
  comments?: Array<{ visibility: 'public' | 'internal'; body: string }>;
};

const demoTickets: DemoTicket[] = [
  {
    marker: 'DEMO-FH-DENGUE-001',
    reportType: 'health',
    title: 'Dengue',
    description: 'Two residents at Block 412 Bedok North have high fever and rash after mosquito bites near the lift lobby.',
    location: 'Block 412 Bedok North Avenue 2, East',
    severity: 'high',
    status: 'submitted',
    agency: { code: 'MOH', name: 'Ministry of Health' },
    subject: { label: 'Dengue', categories: ['health'], description: 'Dengue symptoms, mosquito activity, and cluster reports.' },
    minutesAgo: 18,
    pings: [{ code: 'NEA', name: 'National Environment Agency' }],
  },
  {
    marker: 'DEMO-FH-COVID-001',
    reportType: 'health',
    title: 'COVID-19',
    description: 'Several seniors at a day activity centre in Toa Payoh are coughing and testing positive for COVID-19.',
    location: 'Toa Payoh Central, Central',
    severity: 'medium',
    status: 'in_progress',
    agency: { code: 'MOH', name: 'Ministry of Health' },
    subject: { label: 'COVID-19', categories: ['health'], description: 'Respiratory illness, COVID-19 clusters, testing, or isolation support.' },
    minutesAgo: 42,
    comments: [{ visibility: 'internal', body: 'Clinic liaison requested confirmation of exposed headcount.' }],
  },
  {
    marker: 'DEMO-FH-FLOOD-001',
    reportType: 'flood',
    title: 'Flash flood',
    description: 'Ankle-deep water is building up outside Bukit Timah Plaza and cars are slowing near the junction.',
    location: 'Bukit Timah Road, West',
    severity: 'high',
    status: 'submitted',
    agency: { code: 'PUB', name: 'Public Utilities Board' },
    subject: { label: 'Flash flood', categories: ['flood', 'weather'], description: 'Fast-rising water and flood-prone roads.' },
    minutesAgo: 25,
    pings: [{ code: 'LTA', name: 'Land Transport Authority' }],
  },
  {
    marker: 'DEMO-FH-DRAIN-001',
    reportType: 'flood',
    title: 'Drain overflow',
    description: 'Drain beside Tampines Avenue 9 is overflowing and water is entering the sheltered walkway.',
    location: 'Tampines Avenue 9, East',
    severity: 'medium',
    status: 'submitted',
    agency: { code: 'PUB', name: 'Public Utilities Board' },
    subject: { label: 'Drain overflow', categories: ['flood', 'weather'], description: 'Overflowing drains and localised ponding.' },
    minutesAgo: 54,
  },
  {
    marker: 'DEMO-FH-MEDICINE-001',
    reportType: 'supply',
    title: 'Medicine shortage',
    description: 'Three pharmacies near Jurong Point have no salbutamol inhalers and residents are being turned away.',
    location: 'Jurong Point, West',
    severity: 'high',
    status: 'in_progress',
    agency: { code: 'Enterprise SG', name: 'Enterprise Singapore' },
    subject: { label: 'Medicine shortage', categories: ['supply', 'health'], description: 'Medication stockouts or pharmacy supply shortage reports.' },
    minutesAgo: 71,
    pings: [{ code: 'MOH', name: 'Ministry of Health' }],
  },
  {
    marker: 'DEMO-FH-FOOD-001',
    reportType: 'supply',
    title: 'Food shortage',
    description: 'Supermarket shelves for rice and canned food are empty at Hougang Mall after repeated panic buying.',
    location: 'Hougang Mall, North-East',
    severity: 'medium',
    status: 'submitted',
    agency: { code: 'Enterprise SG', name: 'Enterprise Singapore' },
    subject: { label: 'Food shortage', categories: ['supply'], description: 'Food stockout and essential grocery availability reports.' },
    minutesAgo: 85,
  },
  {
    marker: 'DEMO-FH-POWER-001',
    reportType: 'infrastructure',
    title: 'Power outage',
    description: 'Power outage affecting multiple HDB blocks at Sengkang West; lift lights and corridor lighting are down.',
    location: 'Sengkang West Way, North-East',
    severity: 'high',
    status: 'submitted',
    agency: { code: 'LTA', name: 'Land Transport Authority' },
    subject: { label: 'Power outage', categories: ['infrastructure'], description: 'Electricity outage or critical utility interruption.' },
    minutesAgo: 33,
  },
  {
    marker: 'DEMO-FH-TRAIN-001',
    reportType: 'transport',
    title: 'Train disruption',
    description: 'Platform crowding at Bishan MRT after train service delay; commuters are unable to board safely.',
    location: 'Bishan MRT Station, Central',
    severity: 'medium',
    status: 'submitted',
    agency: { code: 'LTA', name: 'Land Transport Authority' },
    subject: { label: 'Train disruption', categories: ['transport', 'infrastructure'], description: 'Rail delays, station crowding, or service disruption reports.' },
    minutesAgo: 64,
    pings: [{ code: 'SPF', name: 'Singapore Police Force' }],
  },
  {
    marker: 'DEMO-FH-PHISHING-001',
    reportType: 'cybersecurity',
    title: 'Phishing campaign',
    description: 'Residents are receiving SMS links pretending to be official relief payout forms and asking for Singpass details.',
    location: 'Nationwide',
    severity: 'high',
    status: 'submitted',
    agency: { code: 'CSA', name: 'Cyber Security Agency of Singapore' },
    subject: { label: 'Phishing campaign', categories: ['cybersecurity'], description: 'Suspicious links, scam messages, and credential harvesting reports.' },
    minutesAgo: 92,
  },
  {
    marker: 'DEMO-FH-UNGROUPED-001',
    reportType: 'other',
    title: 'Other issue',
    description: 'A loud alarm has been ringing at a public facility near Clementi but residents are unsure which agency owns it.',
    location: 'Clementi Avenue 3, West',
    severity: 'low',
    status: 'submitted',
    agency: { code: 'GOV-OPS', name: 'Government Operations' },
    minutesAgo: 110,
  },
  {
    marker: 'DEMO-FH-ARCHIVE-001',
    reportType: 'environment',
    title: 'Haze',
    description: 'Haze smell reported near Punggol Waterway; NEA checked and readings returned to normal.',
    location: 'Punggol Waterway, North-East',
    severity: 'low',
    status: 'resolved',
    agency: { code: 'NEA', name: 'National Environment Agency' },
    subject: { label: 'Haze', categories: ['environment', 'health'], description: 'Air quality, smoke haze, or outdoor exposure concerns.' },
    minutesAgo: 180,
    comments: [{ visibility: 'public', body: 'NEA reviewed the report. Readings have returned to normal and no further action is required.' }],
  },
  {
    marker: 'DEMO-FH-SPAM-001',
    reportType: 'health',
    title: 'Dengue',
    description: 'haha free money click here this is not real',
    location: 'Unknown',
    severity: 'low',
    status: 'rejected',
    agency: { code: 'MOH', name: 'Ministry of Health' },
    minutesAgo: 12,
  },
  {
    marker: 'DEMO-FH-SPAM-002',
    reportType: 'infrastructure',
    title: 'Power outage',
    description: 'HELLO LOVELLE',
    location: 'Unknown',
    severity: 'low',
    status: 'rejected',
    agency: { code: 'LTA', name: 'Land Transport Authority' },
    minutesAgo: 14,
  },
  {
    marker: 'DEMO-FH-SPAM-003',
    reportType: 'other',
    title: 'Other issue',
    description: 'asdf qwerty qwerty qwerty just testing',
    location: 'Unknown',
    severity: 'low',
    status: 'rejected',
    agency: { code: 'GOV-OPS', name: 'Government Operations' },
    minutesAgo: 16,
  },
];

async function upsertAgency(client: PoolClient, agency: DemoTicket['agency']) {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO auth.government_agencies (code, name)
      VALUES ($1, $2)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `,
    [agency.code, agency.name],
  );
  return result.rows[0].id;
}

async function upsertSubject(client: PoolClient, subject: NonNullable<DemoTicket['subject']>) {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO citizen.report_subject_tags (label, description)
      VALUES ($1, $2)
      ON CONFLICT (label)
      DO UPDATE SET description = COALESCE(EXCLUDED.description, citizen.report_subject_tags.description), updated_at = now()
      RETURNING id
    `,
    [subject.label, subject.description],
  );
  const subjectId = result.rows[0].id;
  await client.query(
    `
      INSERT INTO citizen.report_subject_tag_categories (subject_tag_id, category)
      SELECT $1, unnest($2::text[])
      ON CONFLICT (subject_tag_id, category) DO NOTHING
    `,
    [subjectId, subject.categories],
  );
  return subjectId;
}

async function nextPublicReportId(client: PoolClient) {
  const result = await client.query<{ value: string }>(`SELECT nextval('citizen.report_ticket_seq')::text AS value`);
  return `TKT-${result.rows[0].value.padStart(4, '0')}`;
}

async function main() {
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    await client.query(`
      UPDATE citizen.reports
      SET description = regexp_replace(description, '\\s*DEMO-FH-[A-Z]+-[0-9]+', '', 'g'),
          updated_at = now()
      WHERE description ~ 'DEMO-FH-[A-Z]+-[0-9]+'
    `);
    await client.query(`
      UPDATE citizen.report_comments
      SET body = CASE
          WHEN body = 'Demo pre-filter: spam review item.' THEN 'AI pre-filter: spam review item.'
          WHEN body = 'Demo ticket seeded for form handling walkthrough.' THEN 'Seeded form handling report.'
          ELSE body
        END
      WHERE body IN ('Demo pre-filter: spam review item.', 'Demo ticket seeded for form handling walkthrough.')
    `);
    await client.query(`
      WITH canonical AS (
        SELECT id
        FROM citizen.report_subject_tags
        WHERE lower(label) = 'flash flood'
        ORDER BY created_at ASC
        LIMIT 1
      ),
      duplicate AS (
        SELECT id
        FROM citizen.report_subject_tags
        WHERE lower(label) = 'flash flooding'
      )
      UPDATE citizen.reports
      SET subject_tag_id = canonical.id,
          title = CASE WHEN lower(COALESCE(title, '')) = 'flash flooding' THEN 'Flash flood' ELSE title END,
          updated_at = now()
      FROM canonical, duplicate
      WHERE citizen.reports.subject_tag_id = duplicate.id
         OR lower(COALESCE(citizen.reports.title, '')) = 'flash flooding'
    `);
    await client.query(`
      DELETE FROM citizen.report_subject_tag_categories
      WHERE subject_tag_id IN (
        SELECT id FROM citizen.report_subject_tags WHERE lower(label) = 'flash flooding'
      )
    `);
    await client.query(`
      DELETE FROM citizen.report_subject_tags
      WHERE lower(label) = 'flash flooding'
        AND NOT EXISTS (
          SELECT 1 FROM citizen.reports WHERE reports.subject_tag_id = report_subject_tags.id
        )
    `);

    for (const ticket of demoTickets) {
      const exists = await client.query<{ id: string }>(
        `SELECT id FROM citizen.reports WHERE description = $1 AND COALESCE(location_text, '') = $2 LIMIT 1`,
        [ticket.description, ticket.location],
      );
      if (exists.rows[0]) continue;

      const agencyId = await upsertAgency(client, ticket.agency);
      const subjectId = ticket.subject ? await upsertSubject(client, ticket.subject) : null;
      const publicReportId = await nextPublicReportId(client);
      const createdAt = new Date(Date.now() - ticket.minutesAgo * 60_000).toISOString();

      const report = await client.query<{ id: string }>(
        `
          INSERT INTO citizen.reports (
            public_report_id,
            reporter_label,
            crisis_type,
            report_type,
            title,
            description,
            location_text,
            severity,
            status,
            assigned_agency_id,
            subject_tag_id,
            chat_enabled,
            chat_closed_at,
            created_at,
            updated_at
          )
          VALUES ($1, 'Demo citizen', $2::public.crisis_type, $3, $4, $5, $6, $7::public.severity_level, $8::citizen.report_status, $9, $10, $11, $12, $13, $13)
          RETURNING id
        `,
        [
          publicReportId,
          crisisTypeFor(ticket.reportType),
          ticket.reportType,
          ticket.title,
          ticket.description,
          ticket.location,
          ticket.severity,
          ticket.status,
          agencyId,
          subjectId,
          ticket.status !== 'resolved',
          ticket.status === 'resolved' ? createdAt : null,
          createdAt,
        ],
      );

      const reportId = report.rows[0].id;
      await client.query(
        `
          INSERT INTO citizen.report_comments (report_id, author_type, visibility, body, created_at)
          VALUES ($1, 'system', 'internal', $2, $3)
        `,
        [reportId, ticket.status === 'rejected' ? 'AI pre-filter: spam review item.' : 'Seeded form handling report.', createdAt],
      );

      for (const comment of ticket.comments ?? []) {
        await client.query(
          `
            INSERT INTO citizen.report_comments (report_id, author_type, visibility, body, created_at)
            VALUES ($1, 'government_user', $2, $3, $4)
          `,
          [reportId, comment.visibility, comment.body, createdAt],
        );
      }

      for (const ping of ticket.pings ?? []) {
        const pingAgencyId = await upsertAgency(client, ping);
        await client.query(
          `
            INSERT INTO citizen.report_agency_pings (report_id, agency_id, created_at)
            VALUES ($1, $2, $3)
          `,
          [reportId, pingAgencyId, createdAt],
        );
      }

      inserted += 1;
    }

    await client.query('COMMIT');
    console.log(`Inserted ${inserted} form handling demo tickets.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function crisisTypeFor(reportType: string) {
  if (reportType === 'health') return 'health';
  if (reportType === 'supply') return 'supply_chain';
  if (reportType === 'infrastructure' || reportType === 'transport') return 'infrastructure';
  if (reportType === 'cybersecurity') return 'cybersecurity';
  if (reportType === 'flood' || reportType === 'environment') return 'weather';
  return 'general';
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
