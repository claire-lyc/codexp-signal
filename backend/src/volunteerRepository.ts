import { pool, query } from './db.js';

export type StoredVolunteerProfile = {
  user_id: string;
  profile: Record<string, unknown>;
  updated_at: string;
};

let schemaReady: Promise<void> | null = null;

async function ensureVolunteerSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS citizen.volunteer_profiles (
            user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            profile JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);
      } finally {
        client.release();
      }
    })();
  }

  await schemaReady;
}

export async function getVolunteerProfile(userId: string) {
  await ensureVolunteerSchema();
  const rows = await query<StoredVolunteerProfile>(
    `
      SELECT user_id, profile, updated_at
      FROM citizen.volunteer_profiles
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );
  return rows[0] ?? null;
}

export async function listVolunteerProfiles() {
  await ensureVolunteerSchema();
  return query<StoredVolunteerProfile>(
    `
      SELECT user_id, profile, updated_at
      FROM citizen.volunteer_profiles
      ORDER BY updated_at DESC
    `,
  );
}

export async function upsertVolunteerProfile(userId: string, profile: Record<string, unknown>) {
  await ensureVolunteerSchema();
  const rows = await query<StoredVolunteerProfile>(
    `
      INSERT INTO citizen.volunteer_profiles (user_id, profile, updated_at)
      VALUES ($1, $2::jsonb, now())
      ON CONFLICT (user_id)
      DO UPDATE SET profile = EXCLUDED.profile, updated_at = now()
      RETURNING user_id, profile, updated_at
    `,
    [userId, JSON.stringify(profile)],
  );
  return rows[0] ?? null;
}

export async function patchVolunteerProfile(userId: string, patch: Record<string, unknown>) {
  const existing = await getVolunteerProfile(userId);
  const current = (existing?.profile ?? {}) as Record<string, unknown>;
  return upsertVolunteerProfile(userId, { ...current, ...patch });
}
