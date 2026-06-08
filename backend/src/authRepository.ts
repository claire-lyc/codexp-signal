import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { query, pool } from './db.js';

export type ActorType = 'anonymous_citizen' | 'citizen' | 'government_user' | 'system' | 'external_api';

export type AuthUser = {
  id: string;
  actor_type: ActorType;
  display_name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type AuthenticatedUser = AuthUser & {
  role: string | null;
  agency_id: string | null;
  clearance_level: string | null;
};

export async function createPasswordUser(input: {
  email: string;
  password: string;
  displayName?: string;
  actorType: Extract<ActorType, 'citizen' | 'government_user'>;
  role?: string;
}) {
  const email = normalizeEmail(input.email);
  const passwordHash = await bcrypt.hash(input.password, 12);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query<AuthUser>(
      `
        INSERT INTO auth.users (actor_type, display_name, email)
        VALUES ($1, $2, $3)
        RETURNING id, actor_type, display_name, email, created_at, updated_at
      `,
      [input.actorType, input.displayName ?? null, email],
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
      await client.query(
        `
          INSERT INTO auth.government_user_profiles (user_id, role)
          VALUES ($1, $2)
          ON CONFLICT (user_id)
          DO UPDATE SET role = EXCLUDED.role
        `,
        [user.id, input.role ?? 'operator'],
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
  const email = normalizeEmail(emailInput);
  const rows = await query<AuthenticatedUser & { password_hash: string }>(
    `
      SELECT
        users.id,
        users.actor_type,
        users.display_name,
        users.email,
        users.created_at,
        users.updated_at,
        credentials.password_hash,
        profiles.role,
        profiles.agency_id,
        profiles.clearance_level
      FROM auth.users
      JOIN auth.password_credentials credentials ON credentials.user_id = users.id
      LEFT JOIN auth.government_user_profiles profiles ON profiles.user_id = users.id
      WHERE lower(users.email) = lower($1)
      LIMIT 1
    `,
    [email],
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
        users.created_at,
        users.updated_at,
        profiles.role,
        profiles.agency_id,
        profiles.clearance_level
      FROM auth.users
      LEFT JOIN auth.government_user_profiles profiles ON profiles.user_id = users.id
      WHERE users.id = $1
      LIMIT 1
    `,
    [id],
  );
  return rows[0] ?? null;
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
