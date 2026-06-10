import 'dotenv/config';
import { pool } from './db.js';

const client = await pool.connect();

try {
  await client.query('BEGIN');

  const dashboardAlerts = await client.query<{ id: string }>(
    `
      DELETE FROM dashboard.alerts
      WHERE status <> 'resolved'
      RETURNING id
    `,
  );

  const activeBroadcasts = await client.query<{ id: string }>(
    `
      SELECT id::text
      FROM citizen.broadcasts
      WHERE status <> 'resolved'
    `,
  );
  const activeBroadcastIds = activeBroadcasts.rows.map((row) => row.id);

  let broadcastNotificationCount = 0;
  if (activeBroadcastIds.length) {
    const broadcastNotifications = await client.query<{ id: string }>(
      `
        DELETE FROM auth.user_notifications
        WHERE source_type = 'broadcast'
          AND source_id = ANY($1::text[])
        RETURNING id
      `,
      [activeBroadcastIds],
    );
    broadcastNotificationCount = broadcastNotifications.rowCount ?? 0;
  }

  const broadcasts = await client.query<{ id: string }>(
    `
      DELETE FROM citizen.broadcasts
      WHERE status <> 'resolved'
      RETURNING id
    `,
  );

  let volunteerUrgentAlertCount = 0;
  const volunteerAlertTable = await client.query<{ table_name: string | null }>(
    `SELECT to_regclass('citizen.volunteer_urgent_alerts')::text AS table_name`,
  );

  if (volunteerAlertTable.rows[0]?.table_name) {
    const volunteerUrgentAlerts = await client.query(
      `
        DELETE FROM citizen.volunteer_urgent_alerts
        WHERE status <> 'resolved'
      `,
    );
    volunteerUrgentAlertCount = volunteerUrgentAlerts.rowCount ?? 0;
  }

  await client.query('COMMIT');

  console.log([
    `Cleared ${dashboardAlerts.rowCount ?? 0} active dashboard alert(s).`,
    `Cleared ${broadcasts.rowCount ?? 0} active broadcast(s).`,
    `Cleared ${broadcastNotificationCount} active broadcast notification(s).`,
    `Cleared ${volunteerUrgentAlertCount} active volunteer urgent alert(s).`,
    'Resolved/historical records were left untouched.',
  ].join('\n'));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
