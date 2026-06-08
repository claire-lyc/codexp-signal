import { pool, query } from './db.js';

export type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'grouped';
export type TicketUrgency = 'critical' | 'high' | 'medium' | 'low';

export type TicketComment = {
  id: string;
  author: string;
  visibility: 'public' | 'internal';
  body: string;
  createdAt: string;
};

export type TicketImage = {
  id: string;
  filename: string | null;
  mimeType: string | null;
  byteSize: number | null;
  storageKey: string | null;
  previewUrl: string | null;
  status: string;
  createdAt: string;
};

export type Ticket = {
  id: string;
  timestamp: string;
  reporter: string;
  message: string;
  location: string;
  crisisType: string;
  status: TicketStatus;
  assignedAgency: string;
  urgency: TicketUrgency;
  hasImage: boolean;
  relatedTickets: string[];
  comments: TicketComment[];
  pingedAgencies: string[];
  images?: TicketImage[];
  chatEnabled?: boolean;
};

type ReportStatus = 'submitted' | 'triage' | 'in_progress' | 'grouped' | 'resolved' | 'rejected';
type DbCrisisType = 'health' | 'weather' | 'supply_chain' | 'infrastructure' | 'cybersecurity' | 'public_sentiment' | 'general';

type ReportRow = {
  id: string;
  public_report_id: string;
  reporter_user_id: string | null;
  reporter_label: string;
  reporter_display_name: string | null;
  crisis_type: DbCrisisType;
  report_type: string;
  title: string | null;
  description: string;
  location_text: string | null;
  latitude: string | null;
  longitude: string | null;
  severity: TicketUrgency;
  status: ReportStatus;
  assigned_agency_code: string | null;
  grouped_public_report_id: string | null;
  chat_enabled: boolean;
  created_at: string;
};

type CommentRow = {
  id: string;
  report_id: string;
  author_type: string;
  author_name: string | null;
  visibility: 'public' | 'internal';
  body: string;
  created_at: string;
};

type ImageRow = {
  id: string;
  report_id: string;
  original_filename: string | null;
  mime_type: string | null;
  byte_size: number | null;
  storage_key: string | null;
  processed_metadata: Record<string, unknown>;
  processing_status: string;
  created_at: string;
};

type PingRow = {
  report_id: string;
  agency_code: string;
};

export async function listTickets(filters: {
  agency?: string;
  status?: string;
  crisisType?: string;
  query?: string;
}) {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.agency && filters.agency !== 'All Agencies') {
    values.push(filters.agency);
    clauses.push(`agency.code = $${values.length}`);
  }

  const dbStatus = toDbStatus(filters.status);
  if (dbStatus) {
    values.push(dbStatus);
    clauses.push(`reports.status = $${values.length}`);
  }

  const dbCrisisType = filters.crisisType && filters.crisisType !== 'All' ? toDbCrisisType(filters.crisisType) : null;
  if (dbCrisisType) {
    values.push(dbCrisisType);
    clauses.push(`reports.crisis_type = $${values.length}`);
  }

  if (filters.query?.trim()) {
    values.push(`%${filters.query.trim()}%`);
    clauses.push(`(
      reports.public_report_id ILIKE $${values.length}
      OR reports.description ILIKE $${values.length}
      OR reports.location_text ILIKE $${values.length}
      OR reports.reporter_label ILIKE $${values.length}
    )`);
  }

  const reports = await query<ReportRow>(
    `
      SELECT
        reports.id,
        reports.public_report_id,
        reports.reporter_user_id,
        reports.reporter_label,
        users.display_name AS reporter_display_name,
        reports.crisis_type,
        reports.report_type,
        reports.title,
        reports.description,
        reports.location_text,
        reports.latitude,
        reports.longitude,
        reports.severity,
        reports.status,
        agency.code AS assigned_agency_code,
        grouped.public_report_id AS grouped_public_report_id,
        reports.chat_enabled,
        reports.created_at
      FROM citizen.reports reports
      LEFT JOIN auth.users users ON users.id = reports.reporter_user_id
      LEFT JOIN auth.government_agencies agency ON agency.id = reports.assigned_agency_id
      LEFT JOIN citizen.reports grouped ON grouped.id = reports.grouped_report_id
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY
        CASE reports.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        reports.created_at DESC
    `,
    values,
  );

  return hydrateTickets(reports);
}

export async function getTicketByPublicId(publicReportId: string) {
  const reports = await query<ReportRow>(
    `
      SELECT
        reports.id,
        reports.public_report_id,
        reports.reporter_user_id,
        reports.reporter_label,
        users.display_name AS reporter_display_name,
        reports.crisis_type,
        reports.report_type,
        reports.title,
        reports.description,
        reports.location_text,
        reports.latitude,
        reports.longitude,
        reports.severity,
        reports.status,
        agency.code AS assigned_agency_code,
        grouped.public_report_id AS grouped_public_report_id,
        reports.chat_enabled,
        reports.created_at
      FROM citizen.reports reports
      LEFT JOIN auth.users users ON users.id = reports.reporter_user_id
      LEFT JOIN auth.government_agencies agency ON agency.id = reports.assigned_agency_id
      LEFT JOIN citizen.reports grouped ON grouped.id = reports.grouped_report_id
      WHERE reports.public_report_id = $1
      LIMIT 1
    `,
    [publicReportId],
  );

  const [ticket] = await hydrateTickets(reports);
  return ticket ?? null;
}

export async function listTicketsForReporter(userId: string) {
  const reports = await query<ReportRow>(
    `
      SELECT
        reports.id,
        reports.public_report_id,
        reports.reporter_user_id,
        reports.reporter_label,
        users.display_name AS reporter_display_name,
        reports.crisis_type,
        reports.report_type,
        reports.title,
        reports.description,
        reports.location_text,
        reports.latitude,
        reports.longitude,
        reports.severity,
        reports.status,
        agency.code AS assigned_agency_code,
        grouped.public_report_id AS grouped_public_report_id,
        reports.chat_enabled,
        reports.created_at
      FROM citizen.reports reports
      LEFT JOIN auth.users users ON users.id = reports.reporter_user_id
      LEFT JOIN auth.government_agencies agency ON agency.id = reports.assigned_agency_id
      LEFT JOIN citizen.reports grouped ON grouped.id = reports.grouped_report_id
      WHERE reports.reporter_user_id = $1
      ORDER BY reports.created_at DESC
    `,
    [userId],
  );

  return hydrateTickets(reports);
}

export async function createCitizenTicket(input: {
  reporterUserId?: string | null;
  reporter?: string;
  message: string;
  title?: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  crisisType: string;
  urgency: TicketUrgency;
  reportType?: string;
  images?: Array<{
    originalFilename?: string | null;
    mimeType?: string | null;
    byteSize?: number | null;
    storageKey?: string | null;
    checksumSha256?: string | null;
    previewUrl?: string | null;
  }>;
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const publicReportId = await nextPublicReportId(client);
    const dbCrisisType = toDbCrisisType(input.crisisType);
    const agency = agencyForReport(input.crisisType, input.reportType, input.message, dbCrisisType);
    const agencyId = await upsertAgency(client, agency);

    const reportResult = await client.query<{ id: string }>(
      `
        INSERT INTO citizen.reports (
          public_report_id,
          reporter_user_id,
          reporter_label,
          crisis_type,
          report_type,
          title,
          description,
          location_text,
          latitude,
          longitude,
          severity,
          status,
          assigned_agency_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'submitted', $12)
        RETURNING id
      `,
      [
        publicReportId,
        input.reporterUserId ?? null,
        input.reporter?.trim() || (input.reporterUserId ? 'Authenticated citizen' : 'Citizen (Anonymous)'),
        dbCrisisType,
        input.reportType?.trim() || input.crisisType,
        input.title?.trim() || null,
        input.message.trim(),
        input.location?.trim() || null,
        input.latitude ?? null,
        input.longitude ?? null,
        input.urgency,
        agencyId,
      ],
    );

    const reportId = reportResult.rows[0].id;
    await client.query(
      `
        INSERT INTO citizen.report_comments (report_id, author_user_id, author_type, visibility, body)
        VALUES ($1, NULL, 'system', 'internal', $2)
      `,
      [reportId, 'New citizen ticket opened from public report form.'],
    );

    for (const image of input.images ?? []) {
      await client.query(
        `
          INSERT INTO citizen.report_images (
            report_id,
            original_filename,
            mime_type,
            byte_size,
            storage_bucket,
            storage_key,
            checksum_sha256,
            processed_metadata,
            processing_status
          )
          VALUES ($1, $2, $3, $4, 'local-dev', $5, $6, $7, 'uploaded')
        `,
        [
          reportId,
          image.originalFilename ?? null,
          image.mimeType ?? 'application/octet-stream',
          image.byteSize ?? 0,
          image.storageKey ?? `${publicReportId}/${image.originalFilename ?? 'upload'}`,
          image.checksumSha256 ?? null,
          JSON.stringify({ previewUrl: image.previewUrl ?? null }),
        ],
      );
    }

    await client.query('COMMIT');
    return getTicketByPublicId(publicReportId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateTicketStatus(id: string, status: TicketStatus) {
  await query(
    `
      UPDATE citizen.reports
      SET
        status = $2,
        updated_at = now(),
        chat_enabled = CASE WHEN $2 = 'resolved' THEN false ELSE true END,
        chat_closed_at = CASE WHEN $2 = 'resolved' THEN now() ELSE NULL END
      WHERE public_report_id = $1
    `,
    [id, toDbStatus(status) ?? 'submitted'],
  );
  await addTicketComment(id, {
    body: `Status changed to ${status}.`,
    visibility: 'internal',
    author: 'GOV-HANDLER-001',
    authorType: 'government_user',
  });
  return getTicketByPublicId(id);
}

export async function addTicketComment(
  id: string,
  input: {
    body: string;
    visibility: 'public' | 'internal';
    author?: string;
    authorUserId?: string | null;
    authorType?: 'citizen' | 'government_user' | 'system';
  },
) {
  const ticket = await getReportInternalId(id);
  if (!ticket) return null;
  if (ticket.status === 'resolved' || !ticket.chat_enabled) {
    throw new TicketChatClosedError(id);
  }

  await query(
    `
      INSERT INTO citizen.report_comments (report_id, author_user_id, author_type, visibility, body)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      ticket.id,
      input.authorUserId ?? null,
      input.authorType ?? 'government_user',
      input.visibility,
      input.body.trim(),
    ],
  );
  return getTicketByPublicId(id);
}

export class TicketChatClosedError extends Error {
  constructor(publicReportId: string) {
    super(`Ticket ${publicReportId} is resolved and no longer accepts chat messages.`);
    this.name = 'TicketChatClosedError';
  }
}

export async function pingTicketAgencies(id: string, agencyCodes: string[], pingedByUserId?: string | null) {
  const ticket = await getReportInternalId(id);
  if (!ticket) return null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const code of agencyCodes) {
      const agencyId = await upsertAgency(client, { code, name: code });
      await client.query(
        `
          INSERT INTO citizen.report_agency_pings (report_id, agency_id, pinged_by_user_id)
          VALUES ($1, $2, $3)
        `,
        [ticket.id, agencyId, pingedByUserId ?? null],
      );
    }
    await client.query(
      `
        INSERT INTO citizen.report_comments (report_id, author_user_id, author_type, visibility, body)
        VALUES ($1, $2, 'government_user', 'internal', $3)
      `,
      [ticket.id, pingedByUserId ?? null, `Pinged agencies: ${agencyCodes.join(', ')}.`],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    ticket: await getTicketByPublicId(id),
    pingedAgencies: agencyCodes,
    createdAt: new Date().toISOString(),
  };
}

async function hydrateTickets(reports: ReportRow[]) {
  if (!reports.length) return [];

  const reportIds = reports.map((report) => report.id);
  const [comments, images, pings, childGroups] = await Promise.all([
    query<CommentRow>(
      `
        SELECT
          comments.id,
          comments.report_id,
          comments.author_type,
          users.display_name AS author_name,
          comments.visibility,
          comments.body,
          comments.created_at
        FROM citizen.report_comments comments
        LEFT JOIN auth.users users ON users.id = comments.author_user_id
        WHERE comments.report_id = ANY($1::uuid[])
        ORDER BY comments.created_at ASC
      `,
      [reportIds],
    ),
    query<ImageRow>(
      `
        SELECT id, report_id, original_filename, mime_type, byte_size, storage_key, processed_metadata, processing_status, created_at
        FROM citizen.report_images
        WHERE report_id = ANY($1::uuid[])
        ORDER BY created_at ASC
      `,
      [reportIds],
    ),
    query<PingRow>(
      `
        SELECT pings.report_id, agency.code AS agency_code
        FROM citizen.report_agency_pings pings
        JOIN auth.government_agencies agency ON agency.id = pings.agency_id
        WHERE pings.report_id = ANY($1::uuid[])
        ORDER BY pings.created_at ASC
      `,
      [reportIds],
    ),
    query<{ grouped_report_id: string; public_report_id: string }>(
      `
        SELECT grouped_report_id, public_report_id
        FROM citizen.reports
        WHERE grouped_report_id = ANY($1::uuid[])
      `,
      [reportIds],
    ),
  ]);

  return reports.map((report) => {
    const ticketImages = images.filter((image) => image.report_id === report.id);
    const relatedTickets = [
      ...(report.grouped_public_report_id ? [report.grouped_public_report_id] : []),
      ...childGroups.filter((item) => item.grouped_report_id === report.id).map((item) => item.public_report_id),
    ];

    return {
      id: report.public_report_id,
      timestamp: formatTimestamp(new Date(report.created_at)),
      reporter: report.reporter_display_name ?? report.reporter_label,
      message: report.description,
      location: report.location_text ?? 'Location not provided',
      crisisType: displayCrisisType(report.crisis_type),
      status: fromDbStatus(report.status),
      assignedAgency: report.assigned_agency_code ?? agencyFor(report.crisis_type).code,
      urgency: report.severity,
      hasImage: ticketImages.length > 0,
      relatedTickets,
      comments: comments
        .filter((comment) => comment.report_id === report.id)
        .map((comment) => ({
          id: comment.id,
          author: comment.author_name ?? authorLabel(comment.author_type),
          visibility: comment.visibility,
          body: comment.body,
          createdAt: comment.created_at,
        })),
      pingedAgencies: [...new Set(pings.filter((ping) => ping.report_id === report.id).map((ping) => ping.agency_code))],
      images: ticketImages.map((image) => ({
        id: image.id,
        filename: image.original_filename,
        mimeType: image.mime_type,
        byteSize: image.byte_size,
        storageKey: image.storage_key,
        previewUrl: typeof image.processed_metadata?.previewUrl === 'string' ? image.processed_metadata.previewUrl : null,
        status: image.processing_status,
        createdAt: image.created_at,
      })),
      chatEnabled: report.chat_enabled,
    } satisfies Ticket;
  });
}

async function getReportInternalId(publicReportId: string) {
  const rows = await query<{ id: string; status: ReportStatus; chat_enabled: boolean }>(
    `SELECT id, status, chat_enabled FROM citizen.reports WHERE public_report_id = $1 LIMIT 1`,
    [publicReportId],
  );
  return rows[0] ?? null;
}

async function nextPublicReportId(client: { query: typeof pool.query }) {
  const result = await client.query<{ value: string }>(`SELECT nextval('citizen.report_ticket_seq')::text AS value`);
  return `TKT-${String(result.rows[0].value).padStart(4, '0')}`;
}

async function upsertAgency(client: { query: typeof pool.query }, agency: { code: string; name: string }) {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO auth.government_agencies (code, name)
      VALUES ($1, $2)
      ON CONFLICT (code)
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `,
    [agency.code, agency.name],
  );
  return result.rows[0].id;
}

function toDbStatus(value?: string | null): ReportStatus | null {
  if (!value || value === 'All') return null;
  if (value === 'open') return 'submitted';
  if (value === 'in-progress') return 'in_progress';
  if (value === 'grouped') return 'grouped';
  if (value === 'resolved') return 'resolved';
  return null;
}

function fromDbStatus(value: ReportStatus): TicketStatus {
  if (value === 'in_progress') return 'in-progress';
  if (value === 'grouped') return 'grouped';
  if (value === 'resolved') return 'resolved';
  return 'open';
}

function toDbCrisisType(value: string): DbCrisisType {
  const normalized = value.toLowerCase();
  if (normalized.includes('health') || normalized.includes('medical')) return 'health';
  if (normalized.includes('flood') || normalized.includes('weather') || normalized.includes('environment')) return 'weather';
  if (normalized.includes('supply') || normalized.includes('shortage')) return 'supply_chain';
  if (normalized.includes('transport') || normalized.includes('infrastructure')) return 'infrastructure';
  if (normalized.includes('cyber')) return 'cybersecurity';
  return 'general';
}

function displayCrisisType(value: DbCrisisType) {
  if (value === 'health') return 'Health';
  if (value === 'weather') return 'Weather';
  if (value === 'supply_chain') return 'Supply Chain';
  if (value === 'infrastructure') return 'Infrastructure';
  if (value === 'cybersecurity') return 'Cybersecurity';
  return 'General';
}

function agencyFor(crisisType: DbCrisisType) {
  if (crisisType === 'health') return { code: 'MOH', name: 'Ministry of Health' };
  if (crisisType === 'weather') return { code: 'PUB', name: 'Public Utilities Board' };
  if (crisisType === 'supply_chain') return { code: 'Enterprise SG', name: 'Enterprise Singapore' };
  if (crisisType === 'infrastructure') return { code: 'LTA', name: 'Land Transport Authority' };
  if (crisisType === 'cybersecurity') return { code: 'CSA', name: 'Cyber Security Agency of Singapore' };
  return { code: 'GOV-OPS', name: 'Government Operations' };
}

function agencyForReport(crisisType: string, reportType: string | undefined, message: string, dbCrisisType: DbCrisisType) {
  const normalized = `${reportType ?? ''} ${crisisType} ${message}`.toLowerCase();
  if (normalized.includes('fire')) {
    return { code: 'SCDF', name: 'Singapore Civil Defence Force' };
  }
  if (normalized.includes('hospital') || normalized.includes('clinic') || normalized.includes('medical')) {
    return { code: 'MOH', name: 'Ministry of Health' };
  }
  if (normalized.includes('crime') || normalized.includes('police')) {
    return { code: 'SPF', name: 'Singapore Police Force' };
  }
  return agencyFor(dbCrisisType);
}

function formatTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function authorLabel(actorType: string) {
  if (actorType === 'system') return 'SiGnal System';
  if (actorType === 'citizen') return 'Citizen';
  return 'GOV-HANDLER-001';
}
