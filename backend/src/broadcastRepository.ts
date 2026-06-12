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
  senderName?: string | null;
  senderRole?: string | null;
  senderAgencyCode?: string | null;
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
  if (!rows.length) return defaultBroadcastItems(options);
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
  let updateRows: BroadcastUpdateRow[] = [];
  try {
    updateRows = await query<BroadcastUpdateRow>(
      `
        SELECT id, broadcast_id, body, created_at
        FROM citizen.broadcast_updates
        WHERE broadcast_id = ANY($1::uuid[])
        ORDER BY created_at ASC
      `,
      [rows.map((row) => row.id)],
    );
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }
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

function defaultBroadcastItems(options: { includeResolved?: boolean } = {}): BroadcastItem[] {
  const items: BroadcastItem[] = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Flash Flood Advisory - Central',
      message: 'PUB has verified flash flooding near Orchard underpass and nearby low-lying roads. Avoid flooded roads, stay away from underpasses, and follow LTA diversion updates.',
      severity: 'high',
      target: 'Citizens in Central + PUB, LTA',
      targetAgencies: ['PUB', 'LTA'],
      targetRegions: ['Central'],
      platforms: ['Web', 'Mobile', 'SMS'],
      recipients: 362000,
      status: 'ongoing',
      time: relativeTime(minutesAgo(18)),
      createdAt: minutesAgo(18),
      resolvedAt: null,
      updates: [
        defaultBroadcastUpdate('11111111-1111-4111-8111-111111111112', 'PUB field teams are clearing blocked drains. LTA has started lane diversions around the affected underpass.', 12),
        defaultBroadcastUpdate('11111111-1111-4111-8111-111111111113', 'Water level is receding but pedestrians should continue using marked alternative crossings.', 5),
      ],
      senderName: 'PUB Operations',
      senderRole: 'Duty Officer',
      senderAgencyCode: 'PUB',
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Air Quality Advisory - West and Central',
      message: 'NEA readings show unhealthy PSI levels in parts of the West and Central region. Reduce prolonged outdoor activity and keep medication nearby if sensitive to haze.',
      severity: 'medium',
      target: 'Citizens in West, Central + NEA, MOH',
      targetAgencies: ['NEA', 'MOH'],
      targetRegions: ['West', 'Central'],
      platforms: ['Web', 'Mobile'],
      recipients: 721000,
      status: 'ongoing',
      time: relativeTime(minutesAgo(42)),
      createdAt: minutesAgo(42),
      resolvedAt: null,
      updates: [
        defaultBroadcastUpdate('22222222-2222-4222-8222-222222222223', 'PSI remains elevated. Schools and outdoor operators should monitor updated readings before activities resume.', 25),
        defaultBroadcastUpdate('22222222-2222-4222-8222-222222222224', 'Clinics report mild increase in throat irritation cases. Sensitive groups should avoid strenuous outdoor exercise.', 9),
      ],
      senderName: 'NEA Air Quality Desk',
      senderRole: 'Operations Lead',
      senderAgencyCode: 'NEA',
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Train Service Disruption - East-West Line',
      message: 'LTA is monitoring crowding after an East-West Line signalling fault. Expect additional travel time and use alternative routes where possible.',
      severity: 'medium',
      target: 'All Citizens + LTA',
      targetAgencies: ['LTA'],
      targetRegions: [],
      platforms: ['Web', 'Mobile', 'SMS'],
      recipients: 5001000,
      status: 'ongoing',
      time: relativeTime(minutesAgo(64)),
      createdAt: minutesAgo(64),
      resolvedAt: null,
      updates: [
        defaultBroadcastUpdate('33333333-3333-4333-8333-333333333334', 'Free regular bus bridging has been activated between affected stations.', 44),
        defaultBroadcastUpdate('33333333-3333-4333-8333-333333333335', 'Train frequency is improving. Station staff remain deployed for crowd management.', 16),
      ],
      senderName: 'LTA Rail Operations',
      senderRole: 'Incident Controller',
      senderAgencyCode: 'LTA',
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      title: 'Dengue Cluster Advisory - Bedok North',
      message: 'NEA and MOH completed vector control checks at Bedok North. Residents should continue removing stagnant water and seek care for persistent fever.',
      severity: 'low',
      target: 'Citizens in East + NEA, MOH',
      targetAgencies: ['NEA', 'MOH'],
      targetRegions: ['East'],
      platforms: ['Web', 'Mobile'],
      recipients: 361000,
      status: 'resolved',
      time: relativeTime(minutesAgo(360)),
      createdAt: minutesAgo(360),
      resolvedAt: minutesAgo(75),
      updates: [
        defaultBroadcastUpdate('44444444-4444-4444-8444-444444444445', 'Additional checks found no major breeding hotspots in common areas.', 210),
        defaultBroadcastUpdate('44444444-4444-4444-8444-444444444446', 'Advisory resolved. Residents should keep weekly source-reduction routines.', 75),
      ],
      senderName: 'NEA Vector Control',
      senderRole: 'Field Coordinator',
      senderAgencyCode: 'NEA',
    },
  ];
  return options.includeResolved ? items : items.filter((item) => item.status === 'ongoing');
}

function defaultBroadcastUpdate(id: string, body: string, minutes: number): BroadcastItem['updates'][number] {
  const createdAt = minutesAgo(minutes);
  return {
    id,
    body,
    createdAt,
    time: relativeTime(createdAt),
  };
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function isMissingRelationError(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === '42P01',
  );
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
