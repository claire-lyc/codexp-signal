import { query } from './db.js';

export type BroadcastSeverity = 'critical' | 'high' | 'medium' | 'low';
export type BroadcastStatus = 'draft' | 'ongoing' | 'resolved';

type BroadcastRow = {
  id: string;
  title: string;
  message: string;
  severity: BroadcastSeverity;
  target_type: string;
  target_regions: string[];
  target_agencies: string[] | null;
  platforms: string[];
  status: BroadcastStatus;
  created_at: string;
  resolved_at: string | null;
  dismissed_action: 'notify' | 'ignore' | null;
};

type BroadcastUpdateRow = {
  id: string;
  broadcast_id: string;
  body: string;
  created_at: string;
};

export type BroadcastItem = {
  id: string;
  title: string;
  message: string;
  severity: BroadcastSeverity;
  target: string;
  targetAgencies: string[];
  targetRegions: string[];
  platforms: string[];
  recipients: number;
  status: 'ongoing' | 'resolved';
  time: string;
  createdAt: string;
  resolvedAt: string | null;
  updates: { id: string; body: string; time: string; createdAt: string }[];
  notificationAction?: 'notify' | 'ignore' | null;
};

export async function listBroadcasts(options: { includeResolved?: boolean; userId?: string | null } = {}) {
  const statusClause = options.includeResolved ? `broadcasts.status IN ('ongoing', 'resolved')` : `broadcasts.status = 'ongoing'`;
  const rows = await query<BroadcastRow>(
    `
      SELECT
        broadcasts.id,
        broadcasts.title,
        broadcasts.message,
        broadcasts.severity,
        broadcasts.target_type,
        broadcasts.target_regions,
        COALESCE(array_remove(array_agg(DISTINCT agency.code), NULL), ARRAY[]::text[]) AS target_agencies,
        broadcasts.platforms,
        broadcasts.status,
        broadcasts.created_at,
        broadcasts.resolved_at,
        dismissals.action AS dismissed_action
      FROM citizen.broadcasts broadcasts
      LEFT JOIN auth.broadcast_dismissals dismissals
        ON dismissals.broadcast_id = broadcasts.id
       AND dismissals.user_id = $1
      LEFT JOIN auth.government_agencies agency
        ON agency.id = ANY(broadcasts.target_agency_ids)
      WHERE ${statusClause}
      GROUP BY broadcasts.id, dismissals.action
      ORDER BY broadcasts.created_at DESC
    `,
    [options.userId ?? null],
  );
  return hydrateBroadcasts(rows);
}

export async function createBroadcast(input: {
  createdByUserId?: string | null;
  title: string;
  message: string;
  severity: BroadcastSeverity;
  targetType: 'all_citizens' | 'regions' | 'agencies';
  targetAgencies?: string[];
  targetRegions?: string[];
  platforms?: string[];
}) {
  const targetAgencyIds = input.targetAgencies?.length ? await getAgencyIds(input.targetAgencies) : [];
  const rows = await query<BroadcastRow>(
    `
      INSERT INTO citizen.broadcasts (
        created_by_user_id,
        title,
        message,
        severity,
        target_type,
        target_regions,
        target_agency_ids,
        platforms,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ongoing')
      RETURNING id, title, message, severity, target_type, target_regions, ARRAY[]::text[] AS target_agencies, platforms, status, created_at, resolved_at, NULL::text AS dismissed_action
    `,
    [
      input.createdByUserId ?? null,
      input.title.trim(),
      input.message.trim(),
      input.severity,
      input.targetType,
      input.targetRegions ?? [],
      targetAgencyIds,
      input.platforms ?? ['web'],
    ],
  );
  const items = await hydrateBroadcasts(rows);
  return items[0];
}

export async function resolveBroadcast(id: string) {
  const rows = await query<BroadcastRow>(
    `
      UPDATE citizen.broadcasts
      SET status = 'resolved', resolved_at = now()
      WHERE id = $1
      RETURNING id, title, message, severity, target_type, target_regions, ARRAY[]::text[] AS target_agencies, platforms, status, created_at, resolved_at, NULL::text AS dismissed_action
    `,
    [id],
  );
  const items = await hydrateBroadcasts(rows);
  return items[0] ?? null;
}

export async function unresolveBroadcast(id: string) {
  const rows = await query<BroadcastRow>(
    `
      UPDATE citizen.broadcasts
      SET status = 'ongoing', resolved_at = NULL
      WHERE id = $1
      RETURNING id, title, message, severity, target_type, target_regions, ARRAY[]::text[] AS target_agencies, platforms, status, created_at, resolved_at, NULL::text AS dismissed_action
    `,
    [id],
  );
  const items = await hydrateBroadcasts(rows);
  return items[0] ?? null;
}

export async function deleteBroadcast(id: string) {
  const rows = await query<{ id: string }>(
    `
      DELETE FROM citizen.broadcasts
      WHERE id = $1
      RETURNING id
    `,
    [id],
  );
  return rows[0] ?? null;
}

export async function addBroadcastUpdate(input: { broadcastId: string; authorUserId?: string | null; body: string }) {
  const body = input.body.trim();
  if (!body) return null;
  const rows = await query<BroadcastUpdateRow>(
    `
      INSERT INTO citizen.broadcast_updates (broadcast_id, author_user_id, body)
      SELECT id, $2, $3
      FROM citizen.broadcasts
      WHERE id = $1
        AND status = 'ongoing'
      RETURNING id, broadcast_id, body, created_at
    `,
    [input.broadcastId, input.authorUserId ?? null, body],
  );
  return rows[0] ? toBroadcastUpdate(rows[0]) : null;
}

export async function setBroadcastAction(userId: string, broadcastId: string, action: 'notify' | 'ignore') {
  await query(
    `
      INSERT INTO auth.broadcast_dismissals (user_id, broadcast_id, action)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, broadcast_id)
      DO UPDATE SET action = EXCLUDED.action, created_at = now()
    `,
    [userId, broadcastId, action],
  );

  if (action === 'ignore') {
    await query(
      `
        UPDATE auth.user_notifications
        SET read_at = COALESCE(read_at, now())
        WHERE user_id = $1
          AND source_type = 'broadcast'
          AND source_id = $2
      `,
      [userId, broadcastId],
    );
  }
}

async function hydrateBroadcasts(rows: BroadcastRow[]) {
  if (!rows.length) return [];
  const updateRows = await query<BroadcastUpdateRow>(
    `
      SELECT id, broadcast_id, body, created_at
      FROM citizen.broadcast_updates
      WHERE broadcast_id = ANY($1::uuid[])
      ORDER BY created_at ASC
    `,
    [rows.map((row) => row.id)],
  );
  const updatesByBroadcast = new Map<string, ReturnType<typeof toBroadcastUpdate>[]>();
  for (const row of updateRows) {
    const updates = updatesByBroadcast.get(row.broadcast_id) ?? [];
    updates.push(toBroadcastUpdate(row));
    updatesByBroadcast.set(row.broadcast_id, updates);
  }
  return rows.map((row) => toBroadcastItem(row, updatesByBroadcast.get(row.id) ?? []));
}

async function getAgencyIds(codes: string[]) {
  const cleaned = [...new Set(codes.map((code) => code.trim()).filter(Boolean))];
  if (!cleaned.length) return [];
  const rows = await query<{ id: string }>(
    `
      SELECT id
      FROM auth.government_agencies
      WHERE code = ANY($1::text[])
    `,
    [cleaned],
  );
  return rows.map((row) => row.id);
}

function toBroadcastItem(row: BroadcastRow, updates: BroadcastItem['updates']): BroadcastItem {
  const targetAgencies = row.target_agencies ?? [];
  const targetRegions = row.target_regions ?? [];
  const citizenTargetLabel = targetRegions.length ? `Citizens in ${targetRegions.join(', ')}` : 'All Citizens';
  const targetParts = [
    row.target_type === 'all_citizens' || targetRegions.length ? citizenTargetLabel : null,
    targetAgencies.length ? targetAgencies.join(', ') : row.target_type === 'agencies' ? 'Selected Agencies' : null,
  ].filter(Boolean);
  const citizenRecipients = targetRegions.length ? Math.max(1, targetRegions.length) * 180000 : 5000000;
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    severity: row.severity,
    target: targetParts.join(' + '),
    targetAgencies,
    targetRegions,
    platforms: row.platforms,
    recipients: citizenRecipients + (targetAgencies.length ? Math.max(1, targetAgencies.length) * 1000 : 0),
    status: row.status === 'resolved' ? 'resolved' : 'ongoing',
    time: relativeTime(row.created_at),
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    updates,
    notificationAction: row.dismissed_action,
  };
}

function toBroadcastUpdate(row: BroadcastUpdateRow) {
  return {
    id: row.id,
    body: row.body,
    time: relativeTime(row.created_at),
    createdAt: row.created_at,
  };
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} mins ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}
