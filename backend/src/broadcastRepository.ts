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
  platforms: string[];
  status: BroadcastStatus;
  created_at: string;
  resolved_at: string | null;
  dismissed_action: 'notify' | 'ignore' | null;
};

export type BroadcastItem = {
  id: string;
  title: string;
  message: string;
  severity: BroadcastSeverity;
  target: string;
  platforms: string[];
  recipients: number;
  status: 'ongoing' | 'resolved';
  time: string;
  createdAt: string;
  resolvedAt: string | null;
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
        broadcasts.platforms,
        broadcasts.status,
        broadcasts.created_at,
        broadcasts.resolved_at,
        dismissals.action AS dismissed_action
      FROM citizen.broadcasts broadcasts
      LEFT JOIN auth.broadcast_dismissals dismissals
        ON dismissals.broadcast_id = broadcasts.id
       AND dismissals.user_id = $1
      WHERE ${statusClause}
      ORDER BY broadcasts.created_at DESC
    `,
    [options.userId ?? null],
  );
  return rows.map(toBroadcastItem);
}

export async function createBroadcast(input: {
  createdByUserId?: string | null;
  title: string;
  message: string;
  severity: BroadcastSeverity;
  targetType: 'all_citizens' | 'regions' | 'agencies';
  targetRegions?: string[];
  platforms?: string[];
}) {
  const rows = await query<BroadcastRow>(
    `
      INSERT INTO citizen.broadcasts (
        created_by_user_id,
        title,
        message,
        severity,
        target_type,
        target_regions,
        platforms,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'ongoing')
      RETURNING id, title, message, severity, target_type, target_regions, platforms, status, created_at, resolved_at, NULL::text AS dismissed_action
    `,
    [
      input.createdByUserId ?? null,
      input.title.trim(),
      input.message.trim(),
      input.severity,
      input.targetType,
      input.targetRegions ?? [],
      input.platforms ?? ['web'],
    ],
  );
  return toBroadcastItem(rows[0]);
}

export async function resolveBroadcast(id: string) {
  const rows = await query<BroadcastRow>(
    `
      UPDATE citizen.broadcasts
      SET status = 'resolved', resolved_at = now()
      WHERE id = $1
      RETURNING id, title, message, severity, target_type, target_regions, platforms, status, created_at, resolved_at, NULL::text AS dismissed_action
    `,
    [id],
  );
  return rows[0] ? toBroadcastItem(rows[0]) : null;
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

function toBroadcastItem(row: BroadcastRow): BroadcastItem {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    severity: row.severity,
    target: row.target_type === 'regions' ? row.target_regions.join(', ') || 'Selected Regions' : row.target_type === 'agencies' ? 'Selected Agencies' : 'All Citizens',
    platforms: row.platforms,
    recipients: row.target_type === 'regions' ? Math.max(1, row.target_regions.length) * 200000 : 5000000,
    status: row.status === 'resolved' ? 'resolved' : 'ongoing',
    time: relativeTime(row.created_at),
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    notificationAction: row.dismissed_action,
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
