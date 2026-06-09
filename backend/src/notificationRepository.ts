import { query } from './db.js';
import type { BroadcastItem } from './broadcastRepository.js';

export type UserNotificationType = 'alert' | 'reply' | 'agency_ping' | 'volunteer';

type NotificationRow = {
  id: string;
  type: UserNotificationType;
  title: string;
  body: string;
  link_path: string;
  read_at: string | null;
  created_at: string;
};

export type UserNotification = {
  id: string;
  type: UserNotificationType;
  title: string;
  text: string;
  to: string;
  readAt: string | null;
  createdAt: string;
};

export async function listUserNotifications(userId: string, options: { unreadOnly?: boolean; limit?: number } = {}) {
  const rows = await query<NotificationRow>(
    `
      SELECT id, type, title, body, link_path, read_at, created_at
      FROM auth.user_notifications
      WHERE user_id = $1
        AND ($2::boolean = false OR read_at IS NULL)
      ORDER BY created_at DESC
      LIMIT $3
    `,
    [userId, options.unreadOnly ?? true, options.limit ?? 20],
  );
  return rows.map(toNotification);
}

export async function markUserNotificationRead(userId: string, notificationId: string) {
  const rows = await query<NotificationRow>(
    `
      UPDATE auth.user_notifications
      SET read_at = COALESCE(read_at, now())
      WHERE id = $1
        AND user_id = $2
      RETURNING id, type, title, body, link_path, read_at, created_at
    `,
    [notificationId, userId],
  );
  return rows[0] ? toNotification(rows[0]) : null;
}

export async function enqueueBroadcastNotifications(broadcast: BroadcastItem) {
  await query(
    `
      INSERT INTO auth.user_notifications (user_id, type, title, body, link_path, source_type, source_id)
      SELECT
        users.id,
        'alert',
        $1,
        $2,
        CASE WHEN users.actor_type = 'government_user'::public.actor_type THEN '/gov/broadcast' ELSE '/public/alerts#broadcasts' END,
        'broadcast',
        $3
      FROM auth.users users
      LEFT JOIN auth.user_notification_preferences preferences ON preferences.user_id = users.id
      WHERE COALESCE(preferences.alert_notifications, true) = true
      ON CONFLICT (user_id, source_type, source_id) DO NOTHING
    `,
    [broadcast.title, broadcast.message, broadcast.id],
  );
}

export async function enqueueCitizenReplyNotifications(publicReportId: string, body: string) {
  await query(
    `
      INSERT INTO auth.user_notifications (user_id, type, title, body, link_path, source_type, source_id)
      SELECT users.id, 'reply', $1, $2, $3, 'ticket-citizen-reply', $4
      FROM auth.users users
      JOIN auth.government_user_profiles gov_profile ON gov_profile.user_id = users.id
      LEFT JOIN auth.user_notification_preferences preferences ON preferences.user_id = users.id
      WHERE gov_profile.is_active = true
        AND COALESCE(preferences.reply_notifications, true) = true
      ON CONFLICT (user_id, source_type, source_id) DO NOTHING
    `,
    [`Citizen reply: ${publicReportId}`, body, `/gov/form-handling?ticket=${encodeURIComponent(publicReportId)}`, `${publicReportId}:${Date.now()}`],
  );
}

export async function enqueueGovernmentReplyNotification(publicReportId: string, body: string) {
  await query(
    `
      INSERT INTO auth.user_notifications (user_id, type, title, body, link_path, source_type, source_id)
      SELECT reports.reporter_user_id, 'reply', $1, $2, $3, 'ticket-government-reply', $4
      FROM citizen.reports reports
      LEFT JOIN auth.user_notification_preferences preferences ON preferences.user_id = reports.reporter_user_id
      WHERE reports.public_report_id = $5
        AND reports.reporter_user_id IS NOT NULL
        AND COALESCE(preferences.reply_notifications, true) = true
      ON CONFLICT (user_id, source_type, source_id) DO NOTHING
    `,
    [`Reply on ${publicReportId}`, body, '/public/tickets', `${publicReportId}:${Date.now()}`, publicReportId],
  );
}

export async function enqueueAgencyPingNotifications(publicReportId: string, agencyCodes: string[], body: string) {
  if (!agencyCodes.length) return;
  await query(
    `
      INSERT INTO auth.user_notifications (user_id, type, title, body, link_path, source_type, source_id)
      SELECT users.id, 'agency_ping', $1, $2, $3, 'ticket-agency-ping', $4 || ':' || agency.code
      FROM auth.users users
      JOIN auth.government_user_profiles gov_profile ON gov_profile.user_id = users.id
      JOIN auth.government_agencies agency ON agency.id = gov_profile.agency_id
      LEFT JOIN auth.user_notification_preferences preferences ON preferences.user_id = users.id
      WHERE gov_profile.is_active = true
        AND agency.code = ANY($5::text[])
        AND COALESCE(preferences.agency_ping_notifications, true) = true
      ON CONFLICT (user_id, source_type, source_id) DO NOTHING
    `,
    [
      `Agency ping: ${publicReportId}`,
      body,
      `/gov/form-handling?ticket=${encodeURIComponent(publicReportId)}`,
      `${publicReportId}:${Date.now()}`,
      agencyCodes,
    ],
  );
}

function toNotification(row: NotificationRow): UserNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    text: row.body,
    to: row.link_path,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}
