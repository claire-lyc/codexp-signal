import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { query, pool } from './db.js';

export type ActorType = 'anonymous_citizen' | 'citizen' | 'government_user' | 'system' | 'external_api';

export type AuthUser = {
  id: string;
  actor_type: ActorType;
  display_name: string | null;
  email: string | null;
  username: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type AuthenticatedUser = AuthUser & {
  role: string | null;
  agency_id: string | null;
  agency_code: string | null;
  clearance_level: string | null;
};

export type NotificationPreferences = {
  alertNotifications: boolean;
  replyNotifications: boolean;
  agencyPingNotifications: boolean;
  volunteerNotifications: boolean;
  smsEnabled: boolean;
  phoneNumber: string | null;
};

export async function createPasswordUser(input: {
  email?: string;
  password: string;
  displayName?: string;
  username?: string;
  tags?: string[];
  actorType: Extract<ActorType, 'citizen' | 'government_user'>;
  role?: string;
  agencyCode?: string;
}) {
  const username = input.username?.trim() || null;
  const email = input.email
    ? normalizeEmail(input.email)
    : username
    ? `${username.toLowerCase().replace(/\s+/g, '-')}.citizen@signal.local`
    : null;
  if (!email) {
    throw new Error('Email or username is required');
  }
  const passwordHash = await bcrypt.hash(input.password, 12);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query<AuthUser>(
      `
        INSERT INTO auth.users (actor_type, display_name, email, username, tags)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, actor_type, display_name, email, username, tags, created_at, updated_at
      `,
      [input.actorType, input.displayName ?? username ?? null, email, username, input.tags ?? []],
    );
    const user = userResult.rows[0];

    await client.query(
      `
        INSERT INTO auth.password_credentials (user_id, password_hash)
        VALUES ($1, $2)
      `,
      [user.id, passwordHash],
    );

    if (input.actorType === 'government_user') {
      const agencyId = input.agencyCode ? await upsertAgency(input.agencyCode, client) : null;
      await client.query(
        `
          INSERT INTO auth.government_user_profiles (user_id, agency_id, role)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id)
          DO UPDATE SET agency_id = EXCLUDED.agency_id, role = EXCLUDED.role
        `,
        [user.id, agencyId, input.role ?? 'operator'],
      );
    }

    await client.query('COMMIT');
    return getUserById(user.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyPasswordUser(emailInput: string, password: string) {
  const identifier = normalizeIdentifier(emailInput);
  const rows = await query<AuthenticatedUser & { password_hash: string }>(
    `
      SELECT
        users.id,
        users.actor_type,
        users.display_name,
        users.email,
        users.username,
        users.tags,
        users.created_at,
        users.updated_at,
        credentials.password_hash,
        profiles.role,
        profiles.agency_id,
        agencies.code AS agency_code,
        profiles.clearance_level
      FROM auth.users
      JOIN auth.password_credentials credentials ON credentials.user_id = users.id
      LEFT JOIN auth.government_user_profiles profiles ON profiles.user_id = users.id
      LEFT JOIN auth.government_agencies agencies ON agencies.id = profiles.agency_id
      WHERE lower(users.email) = lower($1)
         OR lower(users.username) = lower($1)
      LIMIT 1
    `,
    [identifier],
  );
  const user = rows[0];
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  const { password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function getUserById(id: string): Promise<AuthenticatedUser | null> {
  const rows = await query<AuthenticatedUser>(
    `
      SELECT
        users.id,
        users.actor_type,
        users.display_name,
        users.email,
        users.username,
        users.tags,
        users.created_at,
        users.updated_at,
        profiles.role,
        profiles.agency_id,
        agencies.code AS agency_code,
        profiles.clearance_level
      FROM auth.users
      LEFT JOIN auth.government_user_profiles profiles ON profiles.user_id = users.id
      LEFT JOIN auth.government_agencies agencies ON agencies.id = profiles.agency_id
      WHERE users.id = $1
      LIMIT 1
    `,
    [id],
  );
  return rows[0] ?? null;
}

export async function upsertPasswordUser(input: {
  username: string;
  password: string;
  displayName?: string;
  email?: string;
  tags?: string[];
  role?: string;
  agencyCode?: string | null;
}) {
  const username = input.username.trim();
  const email = input.email ? normalizeEmail(input.email) : `${username.toLowerCase().replace(/\s+/g, '-')}.demo@signal.local`;
  const passwordHash = await bcrypt.hash(input.password, 12);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let agencyId: string | null = null;
    if (input.agencyCode) {
      agencyId = await upsertAgency(input.agencyCode, client);
    }

    const existingUser = await client.query<{ id: string }>(
      `
        SELECT id
        FROM auth.users
        WHERE lower(username) = lower($1)
        LIMIT 1
      `,
      [username],
    );

    const userResult = existingUser.rows[0]
      ? await client.query<AuthUser>(
          `
            UPDATE auth.users
            SET
              actor_type = 'government_user',
              display_name = $2,
              email = $3,
              username = $4,
              tags = $5,
              updated_at = now()
            WHERE id = $1
            RETURNING id, actor_type, display_name, email, username, tags, created_at, updated_at
          `,
          [existingUser.rows[0].id, input.displayName ?? username, email, username, input.tags ?? [username]],
        )
      : await client.query<AuthUser>(
          `
            INSERT INTO auth.users (actor_type, display_name, email, username, tags)
            VALUES ('government_user', $1, $2, $3, $4)
            RETURNING id, actor_type, display_name, email, username, tags, created_at, updated_at
          `,
          [input.displayName ?? username, email, username, input.tags ?? [username]],
        );
    const user = userResult.rows[0];

    await client.query(
      `
        INSERT INTO auth.password_credentials (user_id, password_hash)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET password_hash = EXCLUDED.password_hash, password_updated_at = now()
      `,
      [user.id, passwordHash],
    );

    await client.query(
      `
        INSERT INTO auth.government_user_profiles (user_id, agency_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id)
        DO UPDATE SET agency_id = EXCLUDED.agency_id, role = EXCLUDED.role
      `,
      [user.id, agencyId, input.role ?? username],
    );

    await client.query('COMMIT');
    return getUserById(user.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertCitizenPasswordUser(input: {
  username: string;
  password: string;
  displayName?: string;
  email?: string;
  tags?: string[];
}) {
  const username = input.username.trim();
  const email = input.email ? normalizeEmail(input.email) : `${username.toLowerCase().replace(/\s+/g, '-')}.demo@signal.local`;
  const passwordHash = await bcrypt.hash(input.password, 12);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingUser = await client.query<{ id: string }>(
      `
        SELECT id
        FROM auth.users
        WHERE lower(username) = lower($1)
        LIMIT 1
      `,
      [username],
    );

    const userResult = existingUser.rows[0]
      ? await client.query<AuthUser>(
          `
            UPDATE auth.users
            SET
              actor_type = 'citizen',
              display_name = $2,
              email = $3,
              username = $4,
              tags = $5,
              updated_at = now()
            WHERE id = $1
            RETURNING id, actor_type, display_name, email, username, tags, created_at, updated_at
          `,
          [existingUser.rows[0].id, input.displayName ?? username, email, username, input.tags ?? ['Citizen']],
        )
      : await client.query<AuthUser>(
          `
            INSERT INTO auth.users (actor_type, display_name, email, username, tags)
            VALUES ('citizen', $1, $2, $3, $4)
            RETURNING id, actor_type, display_name, email, username, tags, created_at, updated_at
          `,
          [input.displayName ?? username, email, username, input.tags ?? ['Citizen']],
        );
    const user = userResult.rows[0];

    await client.query(
      `
        INSERT INTO auth.password_credentials (user_id, password_hash)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET password_hash = EXCLUDED.password_hash, password_updated_at = now()
      `,
      [user.id, passwordHash],
    );

    await client.query('COMMIT');
    return getUserById(user.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  await query(
    `
      INSERT INTO auth.user_notification_preferences (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId],
  );
  const rows = await query<{
    alert_notifications: boolean;
    reply_notifications: boolean;
    agency_ping_notifications: boolean;
    volunteer_notifications: boolean;
    sms_enabled: boolean;
    phone_number: string | null;
  }>(
    `
      SELECT alert_notifications, reply_notifications, agency_ping_notifications, volunteer_notifications, sms_enabled, phone_number
      FROM auth.user_notification_preferences
      WHERE user_id = $1
    `,
    [userId],
  );
  const row = rows[0];
  return {
    alertNotifications: row?.alert_notifications ?? true,
    replyNotifications: row?.reply_notifications ?? true,
    agencyPingNotifications: row?.agency_ping_notifications ?? true,
    volunteerNotifications: row?.volunteer_notifications ?? false,
    smsEnabled: row?.sms_enabled ?? false,
    phoneNumber: row?.phone_number ?? null,
  };
}

export async function updateNotificationPreferences(userId: string, input: Partial<NotificationPreferences>) {
  const smsEnabled = Boolean(input.smsEnabled);
  const phoneNumber = typeof input.phoneNumber === 'string' && input.phoneNumber.trim() ? input.phoneNumber.trim() : null;
  const rows = await query<{
    alert_notifications: boolean;
    reply_notifications: boolean;
    agency_ping_notifications: boolean;
    volunteer_notifications: boolean;
    sms_enabled: boolean;
    phone_number: string | null;
  }>(
    `
      INSERT INTO auth.user_notification_preferences (
        user_id,
        alert_notifications,
        reply_notifications,
        agency_ping_notifications,
        volunteer_notifications,
        sms_enabled,
        phone_number
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id)
      DO UPDATE SET
        alert_notifications = EXCLUDED.alert_notifications,
        reply_notifications = EXCLUDED.reply_notifications,
        agency_ping_notifications = EXCLUDED.agency_ping_notifications,
        volunteer_notifications = EXCLUDED.volunteer_notifications,
        sms_enabled = EXCLUDED.sms_enabled,
        phone_number = EXCLUDED.phone_number,
        updated_at = now()
      RETURNING alert_notifications, reply_notifications, agency_ping_notifications, volunteer_notifications, sms_enabled, phone_number
    `,
    [
      userId,
      input.alertNotifications ?? true,
      input.replyNotifications ?? true,
      input.agencyPingNotifications ?? true,
      input.volunteerNotifications ?? false,
      smsEnabled,
      smsEnabled ? phoneNumber : null,
    ],
  );
  const row = rows[0];
  return {
    alertNotifications: row.alert_notifications,
    replyNotifications: row.reply_notifications,
    agencyPingNotifications: row.agency_ping_notifications,
    volunteerNotifications: row.volunteer_notifications,
    smsEnabled: row.sms_enabled,
    phoneNumber: row.phone_number,
  };
}

export async function createSession(input: {
  userId: string;
  refreshToken: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}) {
  const rows = await query<{ id: string }>(
    `
      INSERT INTO auth.sessions (user_id, refresh_token_hash, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [
      input.userId,
      hashRefreshToken(input.refreshToken),
      input.ipAddress ?? null,
      input.userAgent ?? null,
      input.expiresAt.toISOString(),
    ],
  );
  return rows[0].id;
}

export async function findActiveSessionByRefreshToken(refreshToken: string) {
  const rows = await query<{ id: string; user_id: string; expires_at: string }>(
    `
      SELECT id, user_id, expires_at
      FROM auth.sessions
      WHERE refresh_token_hash = $1
        AND revoked_at IS NULL
        AND expires_at > now()
      LIMIT 1
    `,
    [hashRefreshToken(refreshToken)],
  );
  return rows[0] ?? null;
}

export async function revokeSession(sessionId: string) {
  await query(
    `
      UPDATE auth.sessions
      SET revoked_at = now()
      WHERE id = $1 AND revoked_at IS NULL
    `,
    [sessionId],
  );
}

export function createRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashRefreshToken(refreshToken: string) {
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

async function upsertAgency(code: string, client: { query: typeof pool.query }) {
  const agency = await client.query<{ id: string }>(
    `
      INSERT INTO auth.government_agencies (code, name)
      VALUES ($1, $1)
      ON CONFLICT (code)
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `,
    [code],
  );

  return agency.rows[0].id;
}
