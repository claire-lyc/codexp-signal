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

export type ReportSubjectTag = {
  id: string;
  label: string;
  description: string | null;
  categories: string[];
};

export type Ticket = {
  id: string;
  timestamp: string;
  reporter: string;
  message: string;
  location: string;
  crisisType: string;
  specificCrisis: string | null;
  status: TicketStatus;
  assignedAgency: string;
  urgency: TicketUrgency;
  hasImage: boolean;
  relatedTickets: string[];
  comments: TicketComment[];
  pingedAgencies: string[];
  images?: TicketImage[];
  chatEnabled?: boolean;
  subjectTag: ReportSubjectTag | null;
  startedWorkAt: string | null;
  startedWorkBy: string | null;
  currentHandler: string | null;
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
  grouped_report_id: string | null;
  grouped_public_report_id: string | null;
  subject_tag_id: string | null;
  subject_tag_label: string | null;
  subject_tag_description: string | null;
  started_work_at: string | null;
  started_work_by_name: string | null;
  current_handler_name: string | null;
  chat_enabled: boolean;
  created_at: string;
};

type GroupingCandidate = {
  id: string;
  public_report_id: string;
  crisis_type: DbCrisisType;
  description: string;
  title: string | null;
  location_text: string | null;
  assigned_group_id: string | null;
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

type ImageSummaryRow = {
  report_id: string;
  image_count: number;
};

type PingRow = {
  report_id: string;
  agency_code: string;
};

type SubjectTagRow = {
  id: string;
  label: string;
  description: string | null;
  categories: string[];
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
    clauses.push(`(
      agency.code = $${values.length}
      OR EXISTS (
        SELECT 1
        FROM citizen.report_agency_pings agency_filter_pings
        JOIN auth.government_agencies agency_filter ON agency_filter.id = agency_filter_pings.agency_id
        WHERE agency_filter_pings.report_id = reports.id
          AND agency_filter.code = $${values.length}
      )
    )`);
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
        reports.grouped_report_id,
        grouped.public_report_id AS grouped_public_report_id,
        subject_tags.id AS subject_tag_id,
        subject_tags.label AS subject_tag_label,
        subject_tags.description AS subject_tag_description,
        reports.started_work_at,
        started_by.display_name AS started_work_by_name,
        current_handler.display_name AS current_handler_name,
        reports.chat_enabled,
        reports.created_at
      FROM citizen.reports reports
      LEFT JOIN auth.users users ON users.id = reports.reporter_user_id
      LEFT JOIN auth.government_agencies agency ON agency.id = reports.assigned_agency_id
      LEFT JOIN citizen.reports grouped ON grouped.id = reports.grouped_report_id
      LEFT JOIN citizen.report_subject_tags subject_tags ON subject_tags.id = reports.subject_tag_id
      LEFT JOIN auth.users started_by ON started_by.id = reports.started_work_by_user_id
      LEFT JOIN auth.users current_handler ON current_handler.id = reports.current_handler_user_id
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

  return hydrateTickets(reports, { includeImages: false });
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
        reports.grouped_report_id,
        grouped.public_report_id AS grouped_public_report_id,
        subject_tags.id AS subject_tag_id,
        subject_tags.label AS subject_tag_label,
        subject_tags.description AS subject_tag_description,
        reports.started_work_at,
        started_by.display_name AS started_work_by_name,
        current_handler.display_name AS current_handler_name,
        reports.chat_enabled,
        reports.created_at
      FROM citizen.reports reports
      LEFT JOIN auth.users users ON users.id = reports.reporter_user_id
      LEFT JOIN auth.government_agencies agency ON agency.id = reports.assigned_agency_id
      LEFT JOIN citizen.reports grouped ON grouped.id = reports.grouped_report_id
      LEFT JOIN citizen.report_subject_tags subject_tags ON subject_tags.id = reports.subject_tag_id
      LEFT JOIN auth.users started_by ON started_by.id = reports.started_work_by_user_id
      LEFT JOIN auth.users current_handler ON current_handler.id = reports.current_handler_user_id
      WHERE reports.public_report_id = $1
      LIMIT 1
    `,
    [publicReportId],
  );

  const [ticket] = await hydrateTickets(reports, { includeImages: true });
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
        reports.grouped_report_id,
        grouped.public_report_id AS grouped_public_report_id,
        subject_tags.id AS subject_tag_id,
        subject_tags.label AS subject_tag_label,
        subject_tags.description AS subject_tag_description,
        reports.started_work_at,
        started_by.display_name AS started_work_by_name,
        current_handler.display_name AS current_handler_name,
        reports.chat_enabled,
        reports.created_at
      FROM citizen.reports reports
      LEFT JOIN auth.users users ON users.id = reports.reporter_user_id
      LEFT JOIN auth.government_agencies agency ON agency.id = reports.assigned_agency_id
      LEFT JOIN citizen.reports grouped ON grouped.id = reports.grouped_report_id
      LEFT JOIN citizen.report_subject_tags subject_tags ON subject_tags.id = reports.subject_tag_id
      LEFT JOIN auth.users started_by ON started_by.id = reports.started_work_by_user_id
      LEFT JOIN auth.users current_handler ON current_handler.id = reports.current_handler_user_id
      WHERE reports.reporter_user_id = $1
      ORDER BY reports.created_at DESC
    `,
    [userId],
  );

  return hydrateTickets(reports, { includeImages: false });
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
  subjectTagId?: string | null;
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
          assigned_agency_id,
          subject_tag_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'submitted', $12, $13)
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
        input.subjectTagId ?? null,
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
        status = $2::citizen.report_status,
        subject_tag_id = CASE WHEN $2::citizen.report_status = 'resolved'::citizen.report_status THEN NULL ELSE subject_tag_id END,
        grouped_report_id = CASE WHEN $2::citizen.report_status = 'resolved'::citizen.report_status THEN NULL ELSE grouped_report_id END,
        updated_at = now(),
        chat_enabled = CASE WHEN $2::citizen.report_status = 'resolved'::citizen.report_status THEN false ELSE true END,
        chat_closed_at = CASE WHEN $2::citizen.report_status = 'resolved'::citizen.report_status THEN now() ELSE NULL END
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

export async function listReportSubjectTags() {
  const rows = await query<SubjectTagRow>(
    `
      SELECT
        tags.id,
        tags.label,
        tags.description,
        COALESCE(array_agg(categories.category ORDER BY categories.category) FILTER (WHERE categories.category IS NOT NULL), ARRAY[]::text[]) AS categories
      FROM citizen.report_subject_tags tags
      LEFT JOIN citizen.report_subject_tag_categories categories ON categories.subject_tag_id = tags.id
      GROUP BY tags.id, tags.label, tags.description
      ORDER BY tags.label ASC
    `,
  );
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    description: row.description,
    categories: row.categories ?? [],
  }));
}

export async function createReportSubjectTag(input: {
  label: string;
  description?: string | null;
  categories: string[];
  createdByUserId?: string | null;
}) {
  const label = input.label.trim();
  if (!label) return null;

  const categories = [...new Set(input.categories.map((category) => category.trim().toLowerCase()).filter(Boolean))];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO citizen.report_subject_tags (label, description, created_by_user_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (label)
        DO UPDATE SET description = COALESCE(EXCLUDED.description, citizen.report_subject_tags.description), updated_at = now()
        RETURNING id
      `,
      [label, input.description?.trim() || null, input.createdByUserId ?? null],
    );
    const subjectTagId = result.rows[0].id;

    if (categories.length) {
      await client.query(
        `
          INSERT INTO citizen.report_subject_tag_categories (subject_tag_id, category)
          SELECT $1, unnest($2::text[])
          ON CONFLICT (subject_tag_id, category) DO NOTHING
        `,
        [subjectTagId, categories],
      );
    }

    await client.query('COMMIT');
    const tags = await listReportSubjectTags();
    return tags.find((tag) => tag.id === subjectTagId) ?? null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function setTicketSubjectTag(id: string, subjectTagId: string | null, userId?: string | null) {
  if (subjectTagId) {
    const existing = await query<{ id: string }>(
      `SELECT id FROM citizen.report_subject_tags WHERE id = $1 LIMIT 1`,
      [subjectTagId],
    );
    if (!existing[0]) return null;
  }

  const rows = await query<{ id: string }>(
    `
      UPDATE citizen.reports
      SET subject_tag_id = $2, updated_at = now()
      WHERE public_report_id = $1
      RETURNING id
    `,
    [id, subjectTagId],
  );
  if (!rows[0]) return null;

  await addTicketComment(id, {
    body: subjectTagId ? 'Subject grouping updated.' : 'Subject grouping removed.',
    visibility: 'internal',
    authorUserId: userId ?? null,
    authorType: 'government_user',
  });
  return getTicketByPublicId(id);
}

export async function startTicketWork(id: string, userId?: string | null, userLabel?: string | null) {
  const rows = await query<{ public_report_id: string }>(
    `
      UPDATE citizen.reports
      SET
        status = CASE
          WHEN status = 'resolved'::citizen.report_status THEN status
          ELSE 'in_progress'::citizen.report_status
        END,
        started_work_at = COALESCE(started_work_at, now()),
        started_work_by_user_id = COALESCE(started_work_by_user_id, $2),
        current_handler_user_id = $2,
        updated_at = now()
      WHERE public_report_id = $1
      RETURNING public_report_id
    `,
    [id, userId ?? null],
  );
  if (!rows[0]) return null;

  await addTicketComment(id, {
    body: `Work started${userLabel ? ` by ${userLabel}` : ''}.`,
    visibility: 'internal',
    authorUserId: userId ?? null,
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

export async function deleteTicket(id: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ticket = await client.query<{ id: string; public_report_id: string }>(
      `
        SELECT id, public_report_id
        FROM citizen.reports
        WHERE public_report_id = $1
        LIMIT 1
      `,
      [id],
    );

    if (!ticket.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `
        UPDATE citizen.reports
        SET grouped_report_id = NULL
        WHERE grouped_report_id = $1
      `,
      [ticket.rows[0].id],
    );

    const deleted = await client.query<{ public_report_id: string }>(
      `
        DELETE FROM citizen.reports
        WHERE id = $1
        RETURNING public_report_id
      `,
      [ticket.rows[0].id],
    );
    await client.query('COMMIT');
    return deleted.rows[0] ?? null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function findGroupingCandidate(
  client: { query: typeof pool.query },
  report: GroupingCandidate,
) {
  const rows = await client.query<GroupingCandidate>(
    `
      SELECT
        id,
        public_report_id,
        crisis_type,
        description,
        title,
        location_text,
        grouped_report_id AS assigned_group_id,
        created_at
      FROM citizen.reports
      WHERE id <> $1
        AND crisis_type = $2
        AND created_at >= now() - interval '7 days'
        AND status <> 'resolved'
      ORDER BY created_at DESC
      LIMIT 25
    `,
    [report.id, report.crisis_type],
  );

  const scored = rows.rows
    .map((candidate) => ({ candidate, score: reportSimilarityScore(report, candidate) }))
    .filter((item) => item.score >= 7)
    .sort((left, right) => right.score - left.score);

  return scored[0]?.candidate ?? null;
}

function normalizedTokens(value: string | null | undefined) {
  const stopwords = new Set(['the', 'and', 'with', 'from', 'this', 'that', 'have', 'into', 'near', 'area', 'road', 'station', 'today']);
  return new Set(
    (value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 3 && !stopwords.has(token)),
  );
}

function normalizedLocation(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(north|south|east|west|central)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function reportSimilarityScore(
  left: Pick<GroupingCandidate, 'crisis_type' | 'description' | 'title' | 'location_text' | 'created_at'>,
  right: Pick<GroupingCandidate, 'crisis_type' | 'description' | 'title' | 'location_text' | 'created_at'>,
) {
  let score = 0;
  if (left.crisis_type === right.crisis_type) score += 3;

  const leftLocation = normalizedLocation(left.location_text);
  const rightLocation = normalizedLocation(right.location_text);
  if (leftLocation && rightLocation) {
    if (leftLocation === rightLocation) {
      score += 3;
    } else if (leftLocation.includes(rightLocation) || rightLocation.includes(leftLocation)) {
      score += 2;
    }
  }

  const leftTokens = normalizedTokens(`${left.title ?? ''} ${left.description}`);
  const rightTokens = normalizedTokens(`${right.title ?? ''} ${right.description}`);
  const sharedTokens = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  score += Math.min(sharedTokens, 4);

  const leftTime = new Date(left.created_at).getTime();
  const rightTime = new Date(right.created_at).getTime();
  const ageHours = Math.abs(leftTime - rightTime) / (1000 * 60 * 60);
  if (ageHours <= 48) score += 1;

  return score;
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

async function hydrateTickets(reports: ReportRow[], options: { includeImages?: boolean } = {}) {
  if (!reports.length) return [];

  const reportIds = reports.map((report) => report.id);
  const includeImages = options.includeImages ?? false;
  const [comments, images, imageSummaries, pings, childGroups, subjectCategories, subjectPeers] = await Promise.all([
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
    includeImages
      ? query<ImageRow>(
          `
            SELECT id, report_id, original_filename, mime_type, byte_size, storage_key, processed_metadata, processing_status, created_at
            FROM citizen.report_images
            WHERE report_id = ANY($1::uuid[])
            ORDER BY created_at ASC
          `,
          [reportIds],
        )
      : Promise.resolve([] as ImageRow[]),
    query<ImageSummaryRow>(
      `
        SELECT report_id, COUNT(*)::int AS image_count
        FROM citizen.report_images
        WHERE report_id = ANY($1::uuid[])
        GROUP BY report_id
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
    query<{ id: string; grouped_report_id: string | null; public_report_id: string }>(
      `
        SELECT id, grouped_report_id, public_report_id
        FROM citizen.reports
        WHERE grouped_report_id = ANY($1::uuid[])
           OR id = ANY(
             SELECT grouped_report_id
             FROM citizen.reports
             WHERE id = ANY($1::uuid[])
               AND grouped_report_id IS NOT NULL
           )
      `,
      [reportIds],
    ),
    query<{ subject_tag_id: string; category: string }>(
      `
        SELECT categories.subject_tag_id, categories.category
        FROM citizen.report_subject_tag_categories categories
        JOIN citizen.reports reports ON reports.subject_tag_id = categories.subject_tag_id
        WHERE reports.id = ANY($1::uuid[])
        ORDER BY categories.category ASC
      `,
      [reportIds],
    ),
    query<{ id: string; subject_tag_id: string | null; public_report_id: string }>(
      `
        SELECT id, subject_tag_id, public_report_id
        FROM citizen.reports
        WHERE subject_tag_id = ANY(
          SELECT subject_tag_id
          FROM citizen.reports
          WHERE id = ANY($1::uuid[])
            AND subject_tag_id IS NOT NULL
        )
      `,
      [reportIds],
    ),
  ]);

  return reports.map((report) => {
    const ticketImages = images.filter((image) => image.report_id === report.id);
    const imageCount = imageSummaries.find((image) => image.report_id === report.id)?.image_count ?? 0;
    const relatedTickets = [
      ...(report.grouped_public_report_id ? [report.grouped_public_report_id] : []),
      ...childGroups.filter((item) => item.grouped_report_id === report.id).map((item) => item.public_report_id),
      ...childGroups.filter((item) => item.id === report.grouped_report_id).map((item) => item.public_report_id),
      ...subjectPeers
        .filter((item) => item.subject_tag_id && item.subject_tag_id === report.subject_tag_id)
        .map((item) => item.public_report_id),
    ].filter((ticketId, index, all) => ticketId !== report.public_report_id && all.indexOf(ticketId) === index);

    return {
      id: report.public_report_id,
      timestamp: formatTimestamp(new Date(report.created_at)),
      reporter: report.reporter_display_name ?? report.reporter_label,
      message: report.description,
      location: report.location_text ?? 'Location not provided',
      crisisType: displayCrisisType(report.crisis_type),
      specificCrisis: report.title,
      status: fromDbStatus(report.status),
      assignedAgency: report.assigned_agency_code ?? agencyFor(report.crisis_type).code,
      urgency: report.severity,
      hasImage: includeImages ? ticketImages.length > 0 : imageCount > 0,
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
      subjectTag: report.subject_tag_id
        ? {
            id: report.subject_tag_id,
            label: report.subject_tag_label ?? 'Subject',
            description: report.subject_tag_description,
            categories: subjectCategories
              .filter((category) => category.subject_tag_id === report.subject_tag_id)
              .map((category) => category.category),
          }
        : null,
      startedWorkAt: report.started_work_at,
      startedWorkBy: report.started_work_by_name,
      currentHandler: report.current_handler_name,
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
